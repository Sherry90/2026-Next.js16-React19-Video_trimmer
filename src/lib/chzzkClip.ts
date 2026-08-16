/**
 * Chzzk 클립(`chzzk.naver.com/clips/{uid}`) 네이티브 해석.
 *
 * 번들 도구가 둘 다 클립을 처리하지 못한다:
 *  - yt-dlp: 클립 추출기 자체가 없다(`Unsupported URL`).
 *  - streamlink 8.4.0: 클립 매처는 있으나 플러그인 내부 언팩 버그로 즉시 실패한다.
 *
 * 대신 chzzk 공개 API 3개만 호출하면 progressive muxed MP4 URL을 얻을 수 있어,
 * DASH byte-range 기계(sidx/init 분리, video+audio 별도 표현)조차 필요 없다:
 *
 *   1. play-info      → videoId + inKey (재생 토큰)
 *   2. playback(MPD)  → 정확 duration + 화질별 progressive MP4 BaseURL
 *   3. clip detail    → 제목/썸네일 (best-effort, 실패해도 진행)
 *
 * MP4 CDN은 URL의 `hdnts` 토큰으로 인증하므로 추가 헤더가 필요 없고, Range와 CORS를
 * 모두 허용한다. 따라서 프리뷰는 기존 `/api/video/proxy` 경로를 그대로 태우면 된다.
 */

/** chzzk API는 User-Agent 없으면 거부할 수 있다 (preview 라우트와 동일 패턴). */
const API_HEADERS = {
  "User-Agent": "Mozilla/5.0",
  Referer: "https://chzzk.naver.com/",
} as const;

const API_TIMEOUT_MS = 8000;

/** hdnts 토큰 수명은 8시간이지만, resolve 캐시와 같은 5분으로 짧게 잡아 stale을 피한다. */
const CLIP_CACHE_TTL_MS = 5 * 60 * 1000;

/** 화질을 명시하지 않았을 때의 상한 (플레이어 기본 타깃과 동일). */
const DEFAULT_MAX_HEIGHT = 1080;

export interface ChzzkClipSource {
  /** progressive muxed MP4 (avc1 + mp4a) 직접 URL */
  url: string;
  width: number;
  height: number;
  /** bps */
  bandwidth: number;
  codecs: string;
}

export interface ChzzkClipInfo {
  title: string;
  thumbnail: string;
  /** 초. MPD의 mediaPresentationDuration 기준(정수 초인 detail보다 정확) */
  duration: number;
  /** 짧은 변(=화질 등급) 오름차순 */
  sources: ChzzkClipSource[];
}

/** 사용자에게 그대로 보여줄 한국어 메시지를 가진 클립 전용 에러. */
export class ChzzkClipError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = "ChzzkClipError";
  }
}

const clipCache = new Map<string, { info: ChzzkClipInfo; expires: number }>();

/** URL 입력 한 번에 resolve/waveform/spectrogram이 각각 호출하므로 in-flight도 공유한다. */
const inFlight = new Map<string, Promise<ChzzkClipInfo>>();

async function fetchJson(url: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(url, {
    headers: API_HEADERS,
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: unknown } | null;
  const content = data?.content;
  return content && typeof content === "object" ? (content as Record<string, unknown>) : null;
}

/**
 * ISO8601 duration(`PT1M29.000S`, `PT25.200S`) → 초.
 * MPD가 쓰는 형태(시/분/초)만 처리하면 충분하다.
 */
export function parseIso8601Duration(value: string): number {
  const m = value.match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  if (!m) return 0;
  const [, h, min, s] = m;
  return Number(h ?? 0) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

/** 속성 값 추출. `\b`가 필수 — 없으면 `width`가 `bandwidth="..."` 안에서 매치된다. */
function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/**
 * playback MPD에서 progressive MP4 표현을 뽑는다.
 *
 * MPD에는 AdaptationSet이 둘 있다: `video/mp4`(단일 파일 muxed, 우리가 쓰는 것)와
 * `video/mp2t`(HLS). mp2t 쪽 Representation은 mimeType을 생략(부모 상속)하므로
 * Representation 단위 필터로는 구분되지 않는다 → **AdaptationSet 블록을 먼저 잘라낸 뒤**
 * 그 안에서만 파싱해야 BaseURL 짝이 어긋나지 않는다.
 */
export function parseClipMpd(mpd: string): { duration: number; sources: ChzzkClipSource[] } {
  const durationAttr = mpd.match(/mediaPresentationDuration="([^"]+)"/);
  const duration = durationAttr ? parseIso8601Duration(durationAttr[1]) : 0;

  const sources: ChzzkClipSource[] = [];
  const adaptationSets = mpd.match(/<AdaptationSet[\s\S]*?<\/AdaptationSet>/g) ?? [];

  for (const block of adaptationSets) {
    const head = block.slice(0, block.indexOf(">") + 1);
    if (attr(head, "mimeType") !== "video/mp4") continue;

    const repPattern = /<Representation([^>]*)>([\s\S]*?)<\/Representation>/g;
    let rep: RegExpExecArray | null;
    while ((rep = repPattern.exec(block)) !== null) {
      const [, tagAttrs, body] = rep;
      const baseUrl = body.match(/<BaseURL>([\s\S]*?)<\/BaseURL>/);
      if (!baseUrl) continue;
      sources.push({
        url: baseUrl[1].trim(),
        width: Number(attr(tagAttrs, "width") ?? 0),
        height: Number(attr(tagAttrs, "height") ?? 0),
        bandwidth: Number(attr(tagAttrs, "bandwidth") ?? 0),
        codecs: attr(tagAttrs, "codecs") ?? "",
      });
    }
  }

  sources.sort((a, b) => qualityHeight(a) - qualityHeight(b));
  return { duration, sources };
}

/**
 * 화질 등급으로 쓸 "짧은 변" 길이.
 *
 * 세로 클립은 720p 프로파일이 `width=720 height=1280`으로 들어온다 — height로 비교하면
 * 1080 상한에 걸려 오히려 저화질(480p, height=854)이 선택된다. chzzk 프로파일 이름
 * (`PD_720P_...`)과도 일치하는 짧은 변 기준으로 비교한다.
 */
function qualityHeight(source: ChzzkClipSource): number {
  return source.width > 0 ? Math.min(source.width, source.height) : source.height;
}

/**
 * 화질 선택: maxHeight 이하 중 최고 화질, 없으면 최저 화질.
 * resolve(프리뷰)와 다운로더가 같은 함수를 써서 두 경로의 화질을 일치시킨다.
 */
export function pickClipSource(sources: ChzzkClipSource[], maxHeight?: number): ChzzkClipSource {
  if (sources.length === 0) {
    throw new ChzzkClipError("클립 스트림을 찾을 수 없습니다");
  }
  const limit = maxHeight && maxHeight > 0 ? maxHeight : DEFAULT_MAX_HEIGHT;
  const withinLimit = sources.filter((s) => qualityHeight(s) <= limit);
  // 상한 이하가 하나도 없으면(상한이 최저 화질보다 낮음) 상한 취지를 살려 최저 화질로 폴백
  if (withinLimit.length === 0) {
    return sources.reduce(
      (low, s) => (qualityHeight(s) < qualityHeight(low) ? s : low),
      sources[0],
    );
  }
  return withinLimit.reduce(
    (best, s) => (qualityHeight(s) > qualityHeight(best) ? s : best),
    withinLimit[0],
  );
}

async function loadClipInfo(clipUid: string): Promise<ChzzkClipInfo> {
  const playInfo = await fetchJson(
    `https://api.chzzk.naver.com/service/v1/play-info/clip/${encodeURIComponent(clipUid)}`,
  );
  if (!playInfo) {
    throw new ChzzkClipError("클립을 찾을 수 없습니다", 404);
  }

  const videoId = typeof playInfo.videoId === "string" ? playInfo.videoId : null;
  const inKey = typeof playInfo.inKey === "string" ? playInfo.inKey : null;
  if (!videoId || !inKey) {
    throw new ChzzkClipError(
      playInfo.adult === true
        ? "성인 인증이 필요한 클립은 사용할 수 없습니다"
        : "클립 재생 정보를 가져올 수 없습니다",
      playInfo.adult === true ? 403 : 502,
    );
  }

  const playbackUrl = `https://apis.naver.com/neonplayer/vodplay/v2/playback/${encodeURIComponent(
    videoId,
  )}?key=${encodeURIComponent(inKey)}`;
  const mpdRes = await fetch(playbackUrl, {
    headers: { ...API_HEADERS, Accept: "application/dash+xml" },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!mpdRes.ok) {
    throw new ChzzkClipError("클립 재생 매니페스트를 가져올 수 없습니다");
  }

  const { duration, sources } = parseClipMpd(await mpdRes.text());
  if (sources.length === 0) {
    console.error(
      `[chzzk-clip] no progressive MP4 representation (uid=${clipUid}, vodStatus=${String(
        playInfo.vodStatus,
      )})`,
    );
    throw new ChzzkClipError("이 클립은 지원하지 않는 형식입니다");
  }

  // detail은 제목/썸네일 전용 — 실패해도 재생/다운로드에는 지장이 없으므로 best-effort.
  let title = typeof playInfo.contentTitle === "string" ? playInfo.contentTitle : "Untitled";
  let thumbnail = "";
  try {
    const detail = await fetchJson(
      `https://api.chzzk.naver.com/service/v1/clips/${encodeURIComponent(clipUid)}/detail`,
    );
    if (detail) {
      if (typeof detail.clipTitle === "string" && detail.clipTitle) title = detail.clipTitle;
      if (typeof detail.thumbnailImageUrl === "string") thumbnail = detail.thumbnailImageUrl;
    }
  } catch {
    // 무시 — play-info의 contentTitle로 진행
  }

  return { title, thumbnail, duration, sources };
}

/**
 * 클립 메타데이터 + progressive MP4 표현 목록 조회 (TTL 캐시 + in-flight 공유).
 *
 * URL 입력 한 번에 resolve·waveform·spectrogram이 동시에 호출하므로 캐시/in-flight로
 * chzzk API 타격을 1회로 줄인다. 호출자의 AbortSignal은 일부러 받지 않는다 —
 * 공유 promise가 한 호출자의 취소로 죽으면 다른 호출자까지 실패하기 때문
 * (API 3회는 8초 타임아웃으로 자체 상한).
 */
export async function fetchChzzkClipInfo(clipUid: string): Promise<ChzzkClipInfo> {
  const cached = clipCache.get(clipUid);
  if (cached) {
    if (cached.expires > Date.now()) return cached.info;
    clipCache.delete(clipUid);
  }

  const pending = inFlight.get(clipUid);
  if (pending) return pending;

  const promise = loadClipInfo(clipUid)
    .then((info) => {
      clipCache.set(clipUid, { info, expires: Date.now() + CLIP_CACHE_TTL_MS });
      return info;
    })
    .finally(() => {
      inFlight.delete(clipUid);
    });

  inFlight.set(clipUid, promise);
  return promise;
}
