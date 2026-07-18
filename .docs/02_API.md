# API Documentation

**API 엔드포인트**란, 브라우저(앱 화면)가 서버에 "이거 해 줘"라고 부탁하는 **주소**다. 예를 들어 브라우저가 `/api/video/resolve`로 유튜브 주소를 보내면, 서버가 영상 정보를 찾아 돌려준다. 이 문서는 그런 주소 하나하나가 **무엇을 받고 무엇을 돌려주는지**를 정리한 설명서다.

> 이 주소들이 서로 어떻게 이어져 하나의 흐름이 되는지(큰 그림)는 [01_OVERVIEW.md](./01_OVERVIEW.md) 참조. 여기서는 주소별 상세 스펙만 다룬다.

아래는 Video Trimmer의 모든 Next.js API 엔드포인트 스펙이다.

## 목차

- [Video API](#video-api)
  - [GET /api/video/preview](#get-apivideopreview)
  - [POST /api/video/resolve](#post-apivideoresolve)
  - [GET /api/video/manifest](#get-apivideomanifest)
  - [GET /api/video/proxy](#get-apivideoproxy)
  - [GET /api/video/waveform](#get-apivideowaveform)
  - [GET /api/video/spectrogram](#get-apivideospectrogram)
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

URL 소스의 즉시 프리뷰, 메타데이터 해석, DASH manifest 서빙, 스트림 프록시, 파형/스펙트럴 추출을 담당한다.

### GET /api/video/preview

URL 입력 직후 제목·썸네일을 빠르게 표시하기 위한 경량 프리뷰. `resolve`(yt-dlp)와 **병렬로** 호출한다. 두 소스 모두 CORS 헤더가 없어 서버에서 프록시한다.

**요청:** `GET /api/video/preview?url=<encoded_url>`

**응답 `200`:**

```json
{ "title": "Video Title", "thumbnail": "https://..." }
```

- YouTube → oembed, Chzzk(VOD) → chzzk API. 그 외/live/실패 → `{ "title": null, "thumbnail": null }`(graceful, 클라이언트는 무시).

**에러:** `400`(url 누락/잘못된 URL). 그 외 실패는 빈 결과로 폴백한다.

**구현:** `src/app/api/video/preview/route.ts`

---

### POST /api/video/resolve

URL에서 메타데이터와 재생 소스를 추출한다. YouTube/generic은 다중 화질 **DASH MPD**를 만들고, 실패 시 muxed/HLS로 폴백한다.

**요청:**

```json
{ "url": "https://www.youtube.com/watch?v=..." }
```

**응답 `200` — DASH (YouTube/generic 기본):**

```json
{
  "title": "Video Title",
  "duration": 300,
  "thumbnail": "https://...",
  "streamType": "dash",
  "manifestUrl": "/api/video/manifest?u=<encoded_url>",
  "qualities": [{ "height": 1080 }, { "height": 720 }]
}
```

**응답 `200` — muxed/HLS 폴백 (DASH 실패 또는 Chzzk):**

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

| 필드          | 설명                                                               |
| ------------- | ------------------------------------------------------------------ |
| `streamType`  | `dash`(다중화질 MPD) \| `hls`(세그먼트 재생) \| `mp4`(프록시 재생) |
| `manifestUrl` | DASH일 때만. same-origin manifest 경로(`/api/video/manifest`)      |
| `qualities`   | DASH일 때만. 선택 가능한 화질 목록(높→낮), `{ height }[]`          |
| `url`         | muxed/HLS일 때만. 추출된 스트림 URL                                |
| `tbr`         | muxed/HLS일 때만. 총 비트레이트(kbps), 없으면 `null`               |

**에러:** `400`(잘못된 URL) · `422`(스트림 URL 추출 실패) · `500`(yt-dlp 실패) · `504`(타임아웃)

**구현:** `src/app/api/video/resolve/route.ts`

**내부 로직:**

1. `yt-dlp -J --no-playlist --ffmpeg-location <ffmpeg> <url>` 로 메타데이터 JSON 추출
2. Chzzk가 아니면 `tryBuildDash`로 avc1 video-only + mp4a audio를 묶은 정적 MPD 생성 → `manifestStore`에 보관하고 `streamType: 'dash'` 반환
3. DASH 실패 시 `formatSelector.ts`로 최적 muxed/HLS 선택(**HLS muxed 우선** → HTTPS muxed → `--get-url -f b` 폴백)
4. 동일 URL 재요청을 위해 결과를 인메모리 캐시(TTL `MANIFEST_TTL_MS`, 5분)에 보관

---

### GET /api/video/manifest

`resolve`가 생성·보관한 DASH MPD를 same-origin 경로로 서빙한다(blob: URL은 VHS mpd-parser의 BaseURL 해석을 깨뜨려 실제 URL이 필요).

**요청:** `GET /api/video/manifest?u=<encoded_url>` (`u`는 resolve에 넘긴 원본 URL)

**응답 `200`:** `Content-Type: application/dash+xml` 본문은 MPD XML.

**에러:** `400`(u 누락) · `404`(manifest 만료/없음)

**구현:** `src/app/api/video/manifest/route.ts`

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

- `peaks`: wavesurfer 형태(채널 1개 배열), 정규화 진폭(0~1). 버킷 수 = `round(duration × WAVEFORM.PEAKS_PER_SEC)`(기본 40/초)로 길이 비례, `WAVEFORM.MAX_PEAKS`(32000) 상한. 값은 소수 3자리로 양자화.
- `duration`: 오디오 길이(초)

**응답 `200` (스킵):** `{ "skipped": true, "reason": "too_long" | "aborted" }`

- `too_long`: 추출 PCM이 `MAX_PCM_BYTES`(200MB, 8kHz s16le mono 기준 ~3.4시간)를 넘어 중단 → 클라이언트는 파형을 생략한다. (참고: `WAVEFORM.MAX_DURATION_SEC`(1시간)는 클라이언트 측 게이트이며, 이 엔드포인트가 강제하는 임계는 위 바이트 상한이다.)
- `aborted`: 클라이언트가 요청을 취소함.

**구현:** `src/app/api/video/waveform/route.ts`

**파이프라인:**

```
yt-dlp -f worstaudio/bestaudio/best -N 8 -P temp:<tmpdir> -o -  <url>
  │ (오디오 stdout)
  ▼
ffmpeg -i pipe:0 -ac 1 -ar 8000 -f s16le pipe:1
  │ (raw PCM)
  ▼
duration×PEAKS_PER_SEC 버킷 peak 계산(MAX_PEAKS 상한) → JSON
```

- 원본 URL에서 독립적으로 재해석하므로 resolve 스트림 URL 만료/CORS에 영향받지 않는다.
- 클라이언트는 URL 입력 시 resolve와 **병렬로** prefetch하고(`waveformCache.ts`), 편집 진입 시 캐시를 소비한다.
- `-P temp:<tmpdir>`로 yt-dlp 임시 fragment를 OS 임시 디렉터리에 격리한다(stdout 출력 시 작업 디렉터리 오염 방지).

---

### GET /api/video/spectrogram

오디오만 추출해 **STFT 스펙트로그램**(주파수×시간 강도 프레임)을 반환한다. 타임라인이 파형 아래에 겹쳐 그릴 스펙트럴 데이터를 영상 다운로드 없이 제공한다. waveform과 **병렬로** prefetch한다.

**요청:** `GET /api/video/spectrogram?url=<original_url>`

**응답 `200`:**

```json
{ "duration": 300.0, "sampleRate": 8000, "fftSize": 256, "frames": [[0.0, 0.42, ...], ...] }
```

- `frames`: 프레임별 주파수 bin 강도 배열(`SPECTRAL_FREQ_BINS`개, 기본 128). 강도는 `log10(1 + mag × SPECTRAL_LOG_SCALE)`로 압축해 0~1로 정규화, 소수 3자리 양자화.
- `sampleRate`/`fftSize`: 분석 파라미터(`WAVEFORM_VIEW.SPECTRAL_*`). 프레임 수는 `SPECTRAL_MAX_FRAMES`(기본 2400) 상한이며 초과 시 stride로 솎는다.

**응답 `200` (스킵):** `{ "skipped": true, "reason": "too_long" | "aborted" }`

- `too_long`: 추출 PCM이 `MAX_PCM_BYTES`(200MB, ~3.4시간) 초과 → 클라이언트는 스펙트럴 없이 파형만 표시. (`WAVEFORM.MAX_DURATION_SEC` 1시간은 클라이언트 게이트이며 서버 임계는 위 바이트 상한.)

**에러:** `400`(url 누락/잘못된 URL) · `502`(추출 실패)

**구현:** `src/app/api/video/spectrogram/route.ts` (PCM 추출) + `src/lib/spectrogramCompute.ts` (FFT 연산, `shared/lib/spectrogram.ts` 공유).

**파이프라인:**

```
yt-dlp -f worstaudio/bestaudio/best -N 8 -P temp:<tmpdir> -o -  <url>
  │ (오디오 stdout)
  ▼
ffmpeg -i pipe:0 -ac 1 -ar 8000 -f s16le pipe:1
  │ (raw PCM, -ar = SPECTRAL_SAMPLE_RATE)
  ▼
Hann 윈도우 STFT → 주파수 bin 버킷팅 → 로그 스케일 정규화 → frames
```

- ffmpeg `-ar`는 `WAVEFORM_VIEW.SPECTRAL_SAMPLE_RATE`와 짝이라 분리 시 시간축이 깨진다(동일 상수 사용).
- 로컬(파일) 스펙트럴도 **동일 상수**로 클라이언트에서 계산해 URL/파일 결과가 정합된다.
- 로컬 스펙트럼 연산 실패 시 `shared/lib/retry.ts`(`withRetry`)로 재시도한다.

---

### POST /api/video/trim

URL 영상을 한 번의 요청으로 서버에서 트리밍해 결과 파일을 스트리밍하는 동기 엔드포인트(Streamlink + FFmpeg). 진행률 추적이 필요한 경우 [Download API(SSE)](#download-api-sse)를 사용한다.

**요청:**

```json
{ "originalUrl": "https://...", "startTime": 10.5, "endTime": 30.0, "filename": "trimmed.mp4" }
```

**응답:** 트리밍된 비디오 스트림 (`Content-Type: video/mp4`)

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
data: {"type":"progress","phase":"downloading","progress":45,"processedSeconds":22.5,"totalSeconds":50}
data: {"type":"complete","jobId":"<uuid>","filename":"video.mp4"}
data: {"type":"error","message":"에러 메시지","code":"...","technicalDetails":"..."}
```

> **`complete` 이벤트는 `jobId`와 `filename`을 함께 싣는다**(라이브 스트림 경로, `emitComplete` → 원본 이벤트 그대로 전달). 다만 이미 완료된 작업에 재연결하면 bare `{ type: 'complete' }`만 온다. 다운로드 응답의 `Content-Disposition`에는 파일명이 들어있지 않으므로(아래 참고), 클라이언트는 이 이벤트의 `filename`을 파일명 힌트로 쓴다.
> `progress`의 `processedSeconds`/`totalSeconds`, `error`의 `code`/`technicalDetails`는 optional 필드다.

| Phase         | Chzzk                       | YouTube/Generic                                                  |
| ------------- | --------------------------- | ---------------------------------------------------------------- |
| `downloading` | ✅ (Streamlink)             | ✅ (yt-dlp / aria2c)                                             |
| `processing`  | ✅ (FFmpeg 타임스탬프 리셋) | ✅ 전체 다운로드 폴백 시 로컬 FFmpeg 컷 (byte-range 경로는 생략) |

**클라이언트:**

```typescript
const es = new EventSource(`/api/download/stream/${jobId}`);
es.onmessage = (e) => {
  const d = JSON.parse(e.data);
  if (d.type === "complete") {
    es.close(); // CRITICAL: 서버보다 먼저 닫아 false onerror 방지
    window.location.href = `/api/download/${jobId}`;
  } else if (d.type === "error") {
    es.close();
  }
};
```

**구현:** `src/app/api/download/stream/[jobId]/route.ts`

> **Next.js SSE 버퍼링**: App Router의 `ReadableStream`은 첫 데이터 전까지 응답을 버퍼링한다. 스트림 시작 즉시 주석 라인을 보내 응답을 트리거한다.
>
> ```typescript
> controller.enqueue(encoder.encode(": connected\n\n"));
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

**YouTube/Generic** (`ytdlpDownloader.ts`) — `--download-sections`를 쓰지 않는다. yt-dlp가 구간을 ffmpeg로 직렬 추출하면 연결당 스로틀에 묶여 매우 느리기 때문이다. 대신 두 경로를 순서대로 시도한다:

1. **byte-range 우선** (`byteRangeDownloader.ts`): DASH 단일파일 표현의 `sidx`를 파싱해 **구간에 해당하는 바이트만** Range로 받아 로컬 ffmpeg로 컷. 짧은 클립이 수 초에 끝난다. SSE: `downloading`만.
2. **폴백 — 전체 다운로드 + 로컬 컷**: 선택 포맷 **전체**를 aria2c 다중연결로 받아(연결당 스로틀 우회) 로컬 ffmpeg로 컷·타임스탬프 리셋·faststart. SSE: `downloading` → `processing`.

```bash
# 폴백 경로 (전체 다운로드)
yt-dlp -f "bestvideo[height<=?<maxHeight>]+bestaudio/best" \
  --ffmpeg-location <ffmpeg> -N 8 \
  --external-downloader <aria2c> --downloader-args "aria2c:-x 16 -s 16 -k 1M" \
  -o full.mp4 <url>
ffmpeg -ss START -i full.mp4 -t DUR -c copy -avoid_negative_ts make_zero \
  -fflags +genpts -movflags +faststart final.mp4
```

> aria2c 연결 수(`-x`/`-s`)·`-N`은 `appConfig.DOWNLOAD`에서 설정한다(기본 16/16/8). 전체 다운로드는 스로틀을 우회하므로 구간 ffmpeg 추출보다 훨씬 빠르다.

**클라이언트 진행률 가중치** (`sseProgressUtils.ts`): `downloading` 0–90%, `processing` 90–100%로 매핑해 phase 전환 시 진행률 역행을 방지한다.

---

### GET /api/download/:jobId

완료된 파일을 **서버에서 디스크로 직행** 전달한다(브라우저 JS 힙에 blob을 만들지 않음).

**응답 헤더:**

```
Content-Type: video/mp4
Content-Disposition: attachment
```

> 파일명 없는 bare `attachment`다(`streamUtils.ts`가 `contentDisposition: 'attachment'`만 설정). 파일명은 SSE `complete` 이벤트의 `filename`으로 전달된다(위 참고).

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
  type: "progress";
  phase: "downloading" | "processing" | "completed";
  progress: number; // 0-100
  processedSeconds?: number; // optional
  totalSeconds?: number; // optional
}
export interface SSECompleteEvent {
  type: "complete";
}
export interface SSEErrorEvent {
  type: "error";
  message: string;
  code?: ErrorCode; // 분류 코드 (optional)
  technicalDetails?: string; // stderr 등 기술 원인 (optional)
}
```

> SSE 배선 계층(`downloadTypes.ts`)은 `complete`/`error`에 `jobId`를 덧붙여 실제 발행한다. `complete`는 `filename`도 함께 싣는다(위 stream 섹션 참고).

---

## 성능 고려사항

| API                    | 타임아웃         | 비고                             |
| ---------------------- | ---------------- | -------------------------------- |
| `/api/video/resolve`   | yt-dlp 실행 한도 | 결과 5분 캐시                    |
| `/api/video/proxy`     | 없음             | 스트리밍, Range 패스스루         |
| `/api/video/waveform`  | 추출 한도        | 오디오만, 큰 소스는 느릴 수 있음 |
| `/api/download/start`  | 즉시             | 백그라운드 작업                  |
| `/api/download/stream` | 없음             | SSE 연결 유지                    |

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
