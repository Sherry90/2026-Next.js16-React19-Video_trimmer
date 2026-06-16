import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getYtdlpPath, getFfmpegPath } from '@/lib/binPaths';
import { parseYtdlpError } from '@/lib/apiUtils';
import { selectBestFormat, selectDashFormats } from '@/lib/formatSelector';
import { detectPlatform } from '@/lib/platformDetector';
import { parseInitIndexRange, buildMpd } from '@/lib/dashManifest';
import { setManifest } from '@/lib/manifestStore';
import { toProcessError } from '@/types/process';

// DASH 표현 머리(ftyp+moov+sidx)를 담기 충분한 크기 (관측상 video<2.3KB, audio<1.6KB)
const DASH_HEAD_BYTES = 131072; // 128KB

/**
 * DASH 단일파일 표현의 머리를 Range로 받아 init/index 바이트 범위를 파싱한다.
 * 실패 시 null → 호출부가 해당 표현을 제외하거나 muxed로 폴백.
 */
async function fetchDashRanges(url: string, signal: AbortSignal) {
  try {
    const res = await fetch(url, {
      headers: { Range: `bytes=0-${DASH_HEAD_BYTES - 1}` },
      signal,
    });
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return parseInitIndexRange(buf);
  } catch {
    return null;
  }
}

/**
 * yt-dlp info에서 DASH MPD(다중 화질 video + audio)를 생성한다.
 * avc1 video-only + mp4a audio가 있고 머리 파싱에 성공해야 하며, 아니면 null(→ muxed 폴백).
 * 세그먼트 BaseURL은 CORS/Range를 위해 proxy 경유 절대 URL로 만든다.
 */
async function tryBuildDash(
  info: Record<string, unknown>,
  signal: AbortSignal
): Promise<{ mpd: string; qualities: { height: number }[] } | null> {
  const sel = selectDashFormats(info as never);
  if (!sel) return null;

  // root-relative BaseURL — mpd-parser가 MPD의 실제 URL(브라우저가 쓴 host) 기준으로 해석한다.
  // origin을 하드코딩하면(예: prod hostname 0.0.0.0) cert/CORS 불일치로 깨진다(self-signed는
  // ERR_CERT_COMMON_NAME_INVALID). 상대 경로면 localhost·실도메인·0.0.0.0 어디서든 자동 일치.
  const proxied = (u: string) => `/api/video/proxy?url=${encodeURIComponent(u)}`;

  const videoReps = (
    await Promise.all(
      sel.video.map(async (v) => {
        const ranges = await fetchDashRanges(v.url, signal);
        return ranges
          ? { url: proxied(v.url), codecs: v.codecs, width: v.width, height: v.height, frameRate: v.fps, bandwidth: v.bandwidth, ranges }
          : null;
      })
    )
  ).filter((r): r is NonNullable<typeof r> => r !== null);

  const audioRanges = await fetchDashRanges(sel.audio.url, signal);
  if (videoReps.length === 0 || !audioRanges) return null;

  const durationSec = typeof info.duration === 'number' ? info.duration : 0;
  const mpd = buildMpd({
    video: videoReps,
    audio: {
      url: proxied(sel.audio.url),
      codecs: sel.audio.codecs,
      audioSamplingRate: sel.audio.audioSamplingRate,
      channels: sel.audio.channels,
      bandwidth: sel.audio.bandwidth,
      ranges: audioRanges,
    },
    durationSec,
  });

  const qualities = videoReps.map((r) => ({ height: r.height })).sort((a, b) => b.height - a.height);
  return { mpd, qualities };
}

const execFileAsync = promisify(execFile);

// 인메모리 resolve 캐시: 같은 URL 재요청을 즉시 응답(yt-dlp 스킵).
// TTL은 스트림 URL 만료(googlevideo ~6h)보다 충분히 짧게 잡아 stale URL 방지.
const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;
const resolveCache = new Map<string, { body: Record<string, unknown>; mpd?: string; expires: number }>();

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL이 필요합니다' },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: '유효하지 않은 URL입니다' },
        { status: 400 }
      );
    }

    // 캐시 히트 시 즉시 반환
    const cached = resolveCache.get(url);
    if (cached) {
      if (cached.expires > Date.now()) {
        // DASH 캐시 히트: manifest 스토어가 독립적으로 만료/리셋됐을 수 있으니 재등록
        if (cached.mpd) setManifest(url, cached.mpd);
        return NextResponse.json(cached.body);
      }
      resolveCache.delete(url); // lazy 만료
    }

    // Step 1: Get metadata with -J
    const ytdlp = getYtdlpPath();
    const ffmpeg = getFfmpegPath();
    const { stdout: metaJson } = await execFileAsync(ytdlp, [
      '-J',
      '--no-playlist',
      '--ffmpeg-location', ffmpeg,
      url,
    ], {
      timeout: 60000,
      maxBuffer: 50 * 1024 * 1024, // 50MB - yt-dlp JSON can be large
    });

    const info = JSON.parse(metaJson);

    // Step 2a: YouTube/generic → DASH MPD(다중 화질). web 클라이언트 muxed는 360p뿐이라
    // video-only(avc1)+audio(mp4a)를 묶은 정적 MPD를 만들어 VHS가 고화질 재생하게 한다.
    // 실패하면 아래 muxed 경로로 폴백. Chzzk는 HLS라 스킵.
    const platform = detectPlatform(url);
    if (platform !== 'chzzk') {
      const dash = await tryBuildDash(info, request.signal);
      if (dash) {
        // MPD는 same-origin 경로로 서빙(blob: 불가 — mpd-parser BaseURL 해석 깨짐).
        setManifest(url, dash.mpd);
        const body = {
          title: info.title || 'Untitled',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || '',
          streamType: 'dash' as const,
          manifestUrl: `/api/video/manifest?u=${encodeURIComponent(url)}`,
          qualities: dash.qualities,
        };
        resolveCache.set(url, { body, mpd: dash.mpd, expires: Date.now() + RESOLVE_CACHE_TTL_MS });
        return NextResponse.json(body);
      }
    }

    // Step 2b: Select best format using format selector (muxed / HLS)
    const formatSelection = selectBestFormat(info);
    let streamUrl = formatSelection?.url || null;
    let streamType = formatSelection?.streamType || 'mp4';

    // Last resort: use --get-url to let yt-dlp choose the best format
    if (!streamUrl) {
      try {
        const { stdout: urlOut } = await execFileAsync(ytdlp, [
          '--get-url',
          '-f', 'b',
          '--no-playlist',
          '--ffmpeg-location', ffmpeg,
          url,
        ], { timeout: 30000 });
        streamUrl = urlOut.trim().split('\n')[0];
      } catch {
        // ignore
      }
    }

    if (!streamUrl) {
      return NextResponse.json(
        { error: '스트림 URL을 추출할 수 없습니다' },
        { status: 422 }
      );
    }

    const body = {
      title: info.title || 'Untitled',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || '',
      url: streamUrl,
      ext: 'mp4',
      streamType,
      tbr: formatSelection?.tbr || null, // Total bitrate (kbps)
    };

    resolveCache.set(url, { body, expires: Date.now() + RESOLVE_CACHE_TTL_MS });
    return NextResponse.json(body);
  } catch (error: unknown) {
    const processError = toProcessError(error);
    const { message, status } = parseYtdlpError(processError);
    console.error('[resolve] Error:', processError.message);
    return NextResponse.json({ error: message }, { status });
  }
}
