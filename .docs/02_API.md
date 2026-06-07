# API Documentation

Video Trimmer의 모든 Next.js API 엔드포인트 스펙.

## 목차

- [Video API](#video-api)
  - [POST /api/video/resolve](#post-apivideoresolve)
  - [GET /api/video/proxy](#get-apivideoproxy)
  - [GET /api/video/waveform](#get-apivideowaveform)
  - [POST /api/video/trim](#post-apivideotrim)
- [Download API (SSE)](#download-api-sse)
  - [POST /api/download/start](#post-apidownloadstart)
  - [GET /api/download/stream/:jobId](#get-apidownloadstreamjobid)
  - [GET /api/download/:jobId](#get-apidownloadjobid)
  - [DELETE /api/download/:jobId](#delete-apidownloadjobid)
- [공통 에러 처리](#공통-에러-처리)
- [타입 정의](#타입-정의)
- [성능 고려사항](#성능-고려사항)
- [보안](#보안)

---

## Video API

URL 소스의 메타데이터 해석, 스트림 프록시, 파형 추출을 담당한다.

### POST /api/video/resolve

URL에서 메타데이터와 스트림 URL을 추출한다.

**요청:**
```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

**응답 `200`:**
```json
{
  "title": "Video Title",
  "duration": 300,
  "thumbnail": "https://...",
  "url": "https://stream-url.m3u8",
  "ext": "mp4",
  "streamType": "hls",
  "tbr": 2500
}
```

| 필드 | 설명 |
|------|------|
| `url` | 추출된 스트림 URL (HLS m3u8 또는 직접 HTTP) |
| `streamType` | `hls`(세그먼트 재생) \| `mp4`(프록시 재생) |
| `tbr` | 총 비트레이트(kbps), 없으면 `null` |

**에러:** `400`(잘못된 URL) · `422`(스트림 URL 추출 실패) · `500`(yt-dlp 실패) · `504`(타임아웃)

**구현:** `src/app/api/video/resolve/route.ts`

**내부 로직:**
1. `yt-dlp -J --no-playlist --ffmpeg-location <ffmpeg> <url>` 로 메타데이터 JSON 추출
2. `formatSelector.ts`로 최적 스트림 선택 — **HLS muxed 우선**, 없으면 HTTPS muxed, 그래도 없으면 `--get-url -f b` 폴백
3. 동일 URL 재요청을 위해 결과를 인메모리 캐시(TTL 5분)에 보관

---

### GET /api/video/proxy

원본 스트림을 프록시해 CORS를 우회하고 HLS 재생을 가능케 한다.

**요청:** `GET /api/video/proxy?url=<encoded_url>`

**동작:**
- **HLS(m3u8)**: 본문을 받아 내부 세그먼트/중첩 플레이리스트/`#EXT-X-KEY`/`#EXT-X-MAP` URI를 모두 `/api/video/proxy` 경유로 재작성(`src/lib/hlsProxy.ts`)하여 반환 → 브라우저 video.js가 CORS 제약 없이 세그먼트를 가져온다.
- **그 외(세그먼트·MP4)**: 바이트 패스스루. 클라이언트의 `Range` 헤더를 업스트림으로 전달하고 `Content-Range`/`Accept-Ranges`를 포워드(없으면 `accept-ranges: bytes` 설정) → **시킹 지원**.

**응답 헤더:** `content-type`, `access-control-allow-origin: *`, (HLS) `application/vnd.apple.mpegurl`, (그 외) Range 관련 헤더.

**구현:** `src/app/api/video/proxy/route.ts`

---

### GET /api/video/waveform

영상 전체를 받지 않고 **오디오만** 추출해 다운샘플된 파형 peaks를 반환한다. URL 편집 화면이 영상 다운로드 없이 파형을 그릴 수 있게 한다.

**요청:** `GET /api/video/waveform?url=<original_url>`

**응답 `200`:**
```json
{ "peaks": [[0.0, 0.12, 0.34, ...]], "duration": 300.0 }
```
- `peaks`: wavesurfer 형태(채널 1개 배열), 1000 버킷의 정규화 진폭(0~1)
- `duration`: 오디오 길이(초)

**구현:** `src/app/api/video/waveform/route.ts`

**파이프라인:**
```
yt-dlp -f worstaudio/bestaudio/best -N 8 -P temp:<tmpdir> -o -  <url>
  │ (오디오 stdout)
  ▼
ffmpeg -i pipe:0 -ac 1 -ar 8000 -f s16le pipe:1
  │ (raw PCM)
  ▼
1000 버킷 peak 계산 → JSON
```
- 원본 URL에서 독립적으로 재해석하므로 resolve 스트림 URL 만료/CORS에 영향받지 않는다.
- 클라이언트는 URL 입력 시 resolve와 **병렬로** prefetch하고(`waveformCache.ts`), 편집 진입 시 캐시를 소비한다.
- `-P temp:<tmpdir>`로 yt-dlp 임시 fragment를 OS 임시 디렉터리에 격리한다(stdout 출력 시 작업 디렉터리 오염 방지).

---

### POST /api/video/trim

URL 영상을 한 번의 요청으로 서버에서 트리밍해 결과 파일을 스트리밍하는 동기 엔드포인트(Streamlink + FFmpeg). 진행률 추적이 필요한 경우 [Download API(SSE)](#download-api-sse)를 사용한다.

**요청:**
```json
{ "originalUrl": "https://...", "startTime": 10.5, "endTime": 30.0, "filename": "trimmed.mp4" }
```

**응답:** 트리밍된 비디오 스트림(octet-stream)

**구현:** `src/app/api/video/trim/route.ts` — 2-phase(Streamlink 구간 추출 → FFmpeg 타임스탬프 리셋).

---

## Download API (SSE)

URL 소스 편집의 **구간 다운로드 파이프라인**. 작업을 비동기로 시작하고 Server-Sent Events로 진행률을 스트리밍한 뒤, 완료 파일을 서버에서 디스크로 직행 전달한다.

```
POST /api/download/start            → jobId
GET  /api/download/stream/:jobId    → SSE 진행률
GET  /api/download/:jobId           → 완료 파일(디스크 직행)
DELETE /api/download/:jobId         → 서버 임시 파일 정리
```

### POST /api/download/start

다운로드 작업을 시작하고 jobId를 즉시 반환한다.

**요청:**
```json
{ "url": "https://...", "startTime": 10, "endTime": 60, "filename": "video.mp4", "tbr": 2500 }
```

**응답 `200`:** `{ "jobId": "uuid-v4" }`

**구현:** `src/app/api/download/start/route.ts`
1. `validateDownloadRequest`로 검증
2. UUID 생성
3. `startDownloadJob`을 백그라운드 실행(플랫폼 감지 → 전략 선택)
4. jobId 즉시 반환

---

### GET /api/download/stream/:jobId

SSE로 실시간 진행률을 받는다.

**응답 헤더:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`

**SSE 이벤트:**
```
data: {"type":"progress","progress":45,"processedSeconds":22.5,"totalSeconds":50,"phase":"downloading"}
data: {"type":"complete","filename":"video.mp4"}
data: {"type":"error","message":"에러 메시지"}
```

| Phase | Chzzk | YouTube/Generic |
|-------|-------|-----------------|
| `downloading` | ✅ (Streamlink) | ✅ (yt-dlp) |
| `processing` | ✅ (FFmpeg 타임스탬프 리셋) | ❌ (yt-dlp 내부 통합) |

**클라이언트:**
```typescript
const es = new EventSource(`/api/download/stream/${jobId}`);
es.onmessage = (e) => {
  const d = JSON.parse(e.data);
  if (d.type === 'complete') {
    es.close();                        // CRITICAL: 서버보다 먼저 닫아 false onerror 방지
    window.location.href = `/api/download/${jobId}`;
  } else if (d.type === 'error') {
    es.close();
  }
};
```

**구현:** `src/app/api/download/stream/[jobId]/route.ts`

> **Next.js SSE 버퍼링**: App Router의 `ReadableStream`은 첫 데이터 전까지 응답을 버퍼링한다. 스트림 시작 즉시 주석 라인을 보내 응답을 트리거한다.
> ```typescript
> controller.enqueue(encoder.encode(': connected\n\n'));
> ```

**Platform Strategy** (`src/lib/platformDetector.ts` → `downloadJob.ts`):

**Chzzk** (`streamlinkDownloader.ts`) — 2-phase:
```bash
# Phase 1: Streamlink 구간 다운로드
streamlink --hls-start-offset HH:MM:SS --hls-duration HH:MM:SS \
  --stream-segment-threads 6 <url> best -o temp.mp4
# Phase 2: FFmpeg 타임스탬프 리셋
ffmpeg -i temp.mp4 -c copy -avoid_negative_ts make_zero -fflags +genpts -movflags +faststart final.mp4
```
- 성능: 15–20초(1분 영상). SSE: `downloading` → `processing`.

> **`--hls-duration`**: 표준 `--stream-segmented-duration`은 Chzzk에서 무시되므로 `--hls-duration`을 사용한다(플랫폼 특화 동작).

**YouTube/Generic** (`ytdlpDownloader.ts`) — 1-phase:
```bash
yt-dlp --download-sections "*START-END" \
  -f "bestvideo[height<=?9999]+bestaudio/best" \
  --postprocessor-args "ffmpeg:-avoid_negative_ts make_zero -fflags +genpts -movflags +faststart" \
  --ffmpeg-location <ffmpeg> -N 8 \
  --external-downloader aria2c --external-downloader-args "aria2c:-x 16 -s 16" \
  -o final.mp4 <url>
```
- 성능: ~30–32초(1분 영상). SSE: `downloading`만(FFmpeg 후처리를 yt-dlp가 내부 통합).

> **`-N` 한계**: 병렬 연결 수를 늘려도 구간 다운로드 속도는 개선되지 않는다(서버 측 throttle 추정). 병목은 클라이언트가 아니다.

**클라이언트 진행률 가중치** (`sseProgressUtils.ts`): `downloading` 0–90%, `processing` 90–100%로 매핑해 phase 전환 시 진행률 역행을 방지한다.

---

### GET /api/download/:jobId

완료된 파일을 **서버에서 디스크로 직행** 전달한다(브라우저 JS 힙에 blob을 만들지 않음).

**응답 헤더:**
```
Content-Type: video/mp4
Content-Disposition: attachment; filename*=UTF-8''video.mp4
```
**구현:** `src/app/api/download/[jobId]/route.ts` — 파일을 attachment로 스트리밍한다. **스트림 종료 시 자동 삭제하지 않는다**(중단 후 재다운로드 보존). 정리는 `JOB_TTL_MS`(lazy)와 `DELETE`에 위임한다.

### DELETE /api/download/:jobId

작업과 서버 임시 파일을 정리한다(`deleteJob`). 클라이언트는 편집 reset 시 호출한다.

---

## 공통 에러 처리

**파일:** `src/lib/apiUtils.ts`

**`parseYtdlpError(error)`** — yt-dlp 에러를 사용자 메시지 + HTTP status로 변환:
- `ENOENT` → 500 "yt-dlp를 찾을 수 없습니다"
- `killed` → 504 "요청 시간이 초과되었습니다"
- `Unsupported URL` → 400 "지원하지 않는 URL입니다"

**`validateDownloadRequest(body)` / `validateTrimRequest(body)`** — 요청 본문 검증(URL 문자열, `startTime ≥ 0`, `endTime > startTime`, `filename` 문자열). 각각 독립 구현이다.

---

## 타입 정의

**파일:** `src/types/sse.ts`
```typescript
export type SSEEvent = SSEProgressEvent | SSECompleteEvent | SSEErrorEvent;

export interface SSEProgressEvent {
  type: 'progress';
  progress: number;
  processedSeconds: number;
  totalSeconds: number;
  phase: 'downloading' | 'processing' | 'completed';
}
export interface SSECompleteEvent { type: 'complete'; filename: string; }
export interface SSEErrorEvent { type: 'error'; message: string; }
```

---

## 성능 고려사항

| API | 타임아웃 | 비고 |
|-----|----------|------|
| `/api/video/resolve` | yt-dlp 실행 한도 | 결과 5분 캐시 |
| `/api/video/proxy` | 없음 | 스트리밍, Range 패스스루 |
| `/api/video/waveform` | 추출 한도 | 오디오만, 큰 소스는 느릴 수 있음 |
| `/api/download/start` | 즉시 | 백그라운드 작업 |
| `/api/download/stream` | 없음 | SSE 연결 유지 |

- 프록시/다운로드는 chunked로 메모리 효율적. 다운로드 임시 파일은 tmp에 저장하고 TTL/DELETE로 정리.
- Job 레지스트리는 인메모리. SSE 연결당 1 스트림.

---

## 보안

- **CORS**: `/api/video/proxy`는 모든 origin 허용(프록시 특성상 필수). API 라우트는 COEP에서 제외된다.
- **입력 검증**: URL 문자열 타입 + yt-dlp 검증, 시간 범위 검증.
- **리소스 제한**: 프로세스 타임아웃, 임시 파일 TTL/DELETE 정리, 완료 후 Job 삭제.

---

## 참고

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) · [Streamlink](https://streamlink.github.io/) · [FFmpeg](https://ffmpeg.org/documentation.html) · [SSE 스펙](https://html.spec.whatwg.org/multipage/server-sent-events.html)
