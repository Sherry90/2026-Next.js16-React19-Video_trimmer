# API Documentation

Video Trimmer의 모든 API 엔드포인트에 대한 상세 문서입니다.

## 목차

- [Video API](#video-api)
  - [POST /api/video/resolve](#post-apivideoresolve)
  - [GET /api/video/proxy](#get-apivideoproxy)
  - [POST /api/video/trim](#post-apivideotrim-chzzk-레거시)
- [Download API (SSE)](#download-api-sse)
  - [POST /api/download/start](#post-apidownloadstart)
  - [GET /api/download/stream/:jobId](#get-apidownloadstreamjobid)
  - [GET /api/download/:jobId](#get-apidownloadjobid)
- [공통 에러 처리](#공통-에러-처리)
- [타입 정의](#타입-정의)
- [성능 고려사항](#성능-고려사항)
- [보안](#보안)
- [개발/디버깅](#개발디버깅)
- [cut_video.sh와 TypeScript 구현 비교](#cut_videosh와-typescript-구현-비교)

---

## Video API

### POST /api/video/resolve

YouTube, Chzzk 등의 URL에서 스트리밍 정보를 추출합니다.

**엔드포인트:** `POST /api/video/resolve`

**요청 본문:**
```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**응답 (성공):** `200 OK`
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

**필드 설명:**
- `title` (string): 비디오 제목
- `duration` (number): 길이 (초)
- `thumbnail` (string): 썸네일 URL
- `url` (string): 스트리밍 URL (HLS 또는 직접 URL)
- `ext` (string): 확장자 (항상 "mp4")
- `streamType` ("hls" | "mp4"): 스트림 타입
  - `hls`: HLS 스트림 (직접 재생)
  - `mp4`: HTTP 스트림 (프록시 필요)
- `tbr` (number | null): 총 비트레이트 (kbps)

**응답 (에러):**
```json
{
  "error": "에러 메시지"
}
```

**에러 코드:**
- `400`: 잘못된 URL
- `500`: yt-dlp 실행 실패
- `504`: 타임아웃

**사용된 바이너리:**
- `yt-dlp`: 비디오 정보 추출
- `ffmpeg`: yt-dlp가 내부적으로 사용

**구현 파일:** `src/app/api/video/resolve/route.ts`

**내부 로직:**
1. yt-dlp 실행: `yt-dlp -j --no-warnings <url>`
2. JSON 응답 파싱
3. `formatSelector.ts`로 최적 스트림 선택
   - 우선순위: HLS muxed > HTTPS muxed
4. 스트림 정보 반환

---

### GET /api/video/proxy

HTTP 스트림을 프록시하여 CORS 제한을 우회합니다.

**엔드포인트:** `GET /api/video/proxy?url=<encoded_url>`

**쿼리 파라미터:**
- `url` (required): 인코딩된 스트리밍 URL

**응답 헤더:**
```
Content-Type: video/mp4
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, HEAD, OPTIONS
Access-Control-Allow-Headers: Range
Access-Control-Expose-Headers: Content-Length, Content-Range
```

**응답:** 비디오 스트림 (chunked transfer)

**사용 시나리오:**
- streamType이 "mp4"인 경우 (HLS가 아닌 직접 HTTP 스트림)
- video.js가 `/api/video/proxy?url=<encoded>`로 요청

**구현 파일:** `src/app/api/video/proxy/route.ts`

**내부 로직:**
1. URL 디코딩 및 검증
2. fetch로 원본 URL 요청
3. ReadableStream 생성
4. CORS 헤더와 함께 스트림 반환

**제한사항:**
- 타임아웃: 없음 (스트리밍)
- Range 요청: 지원하지 않음 (전체 스트림만)

---

### POST /api/video/trim (Chzzk 레거시)

> ⚠️ **레거시 엔드포인트**: 이 API는 Chzzk 전용으로 처음 구현된 레거시입니다.
> 현재 권장 방식은 `/api/download/start` → SSE → `/api/download/:jobId` 흐름입니다.
> SSE 기반 다운로드는 Chzzk와 YouTube 모두를 지원하고 실시간 진행률을 제공합니다.

URL 기반 비디오를 서버 사이드에서 트리밍합니다 (Chzzk HLS 전용).

**엔드포인트:** `POST /api/video/trim`

**요청 본문:**
```json
{
  "originalUrl": "https://...",
  "startTime": 10.5,
  "endTime": 30.0,
  "filename": "trimmed.mp4"
}
```

**응답:** 트리밍된 비디오 파일 (octet-stream)

**사용된 바이너리:**
- `streamlink`: HLS 스트림 다운로드 (Phase 1)
- `ffmpeg`: 타임스탬프 리셋 (Phase 2)

**구현 파일:** `src/app/api/video/trim/route.ts`

**내부 로직 (2단계 프로세스):**

**Phase 1: Streamlink 다운로드**
```bash
streamlink \
  --hls-start-offset HH:MM:SS \
  --hls-duration HH:MM:SS \
  --stream-segment-threads 6 \
  <url> best -o temp.mp4
```

**Phase 2: FFmpeg 타임스탬프 리셋**
```bash
ffmpeg -i temp.mp4 \
  -c copy \
  -avoid_negative_ts make_zero \
  -fflags +genpts \
  -movflags +faststart \
  output.mp4
```

---

## Download API (SSE)

Server-Sent Events를 사용한 실시간 진행률 스트리밍.

### POST /api/download/start

다운로드 작업을 시작하고 jobId를 반환합니다.

**엔드포인트:** `POST /api/download/start`

**요청 본문:**
```json
{
  "url": "https://...",
  "startTime": 10,
  "endTime": 60,
  "filename": "video.mp4",
  "tbr": 2500
}
```

**응답:** `200 OK`
```json
{
  "jobId": "uuid-v4"
}
```

**에러 응답:**
```json
{
  "error": "에러 메시지"
}
```

**구현 파일:** `src/app/api/download/start/route.ts`

**내부 로직:**
1. 요청 검증 (`validateDownloadRequest`)
2. UUID 생성
3. `startDownloadJob` 백그라운드 실행 (플랫폼 감지 → 전략 선택)
4. jobId 즉시 반환

---

### GET /api/download/stream/:jobId

SSE 스트림으로 실시간 진행률을 받습니다.

**엔드포인트:** `GET /api/download/stream/:jobId`

**응답 헤더:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**SSE 이벤트 형식:**

**진행률 이벤트:**
```
data: {"type":"progress","progress":45,"processedSeconds":22.5,"totalSeconds":50,"phase":"downloading"}
```

**완료 이벤트:**
```
data: {"type":"complete","filename":"video.mp4"}
```

**에러 이벤트:**
```
data: {"type":"error","message":"에러 메시지"}
```

**Phase 설명:**

| Phase | 플랫폼 | 설명 |
|-------|--------|------|
| `downloading` | Chzzk, YouTube | 다운로더 실행 중 (0-100%) |
| `processing` | **Chzzk만** | FFmpeg 타임스탬프 리셋 (0-100%) |

- **Chzzk**: `downloading` (Streamlink) → `processing` (FFmpeg)
- **YouTube/Generic**: `downloading`만 (yt-dlp + FFmpeg를 내부에서 통합 처리)

**클라이언트 사용법:**
```typescript
const eventSource = new EventSource(`/api/download/stream/${jobId}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'progress') {
    console.log(`${data.phase}: ${data.progress}%`);
  } else if (data.type === 'complete') {
    eventSource.close();  // CRITICAL: 먼저 닫기 (onerror 방지)
    window.location.href = `/api/download/${jobId}`;
  } else if (data.type === 'error') {
    console.error(data.message);
    eventSource.close();
  }
};

eventSource.onerror = (error) => {
  if (eventSourceRef.current) {  // 아직 열려있으면 진짜 에러
    console.error('Connection error:', error);
  }
  // null이면 정상 완료 후 닫힌 것 (무시)
};
```

**구현 파일:** `src/app/api/download/stream/[jobId]/route.ts`

**구현 주의사항 — Next.js SSE 버퍼링:**
Next.js App Router의 `ReadableStream`은 첫 데이터 전송 전까지 ~24초 버퍼링.
스트림 시작 시 즉시 heartbeat를 전송하여 응답 시작을 트리거해야 함:

```typescript
// ✅ 스트림 시작 즉시 전송 (Next.js 버퍼링 방지)
controller.enqueue(encoder.encode(': connected\n\n'));
```

SSE 주석 라인(`:` 시작)은 브라우저가 무시하므로 클라이언트에 영향 없음.

**Platform Strategy:**

다운로드 작업은 URL 도메인에 따라 적절한 전략을 자동 선택합니다:

```typescript
// src/lib/platformDetector.ts
detectPlatform(url: string): 'chzzk' | 'youtube' | 'generic'
selectDownloadStrategy(platform, streamType): 'streamlink' | 'ytdlp'
```

**플랫폼별 다운로더:**

**1. Chzzk** (`src/lib/streamlinkDownloader.ts`) — 2-phase:
```bash
# Phase 1: Streamlink (HLS 구간 다운로드)
streamlink \
  --hls-start-offset HH:MM:SS \
  --hls-duration HH:MM:SS \
  --stream-segment-threads 6 \
  <url> best -o temp.mp4

# Phase 2: FFmpeg (타임스탬프 리셋)
ffmpeg -i temp.mp4 \
  -c copy \
  -avoid_negative_ts make_zero \
  -fflags +genpts \
  -movflags +faststart \
  final.mp4
```
- 병렬 다운로드: `--stream-segment-threads 6`
- 성능: 15-20초 (1분 영상)
- SSE phase: `downloading` → `processing`

> **`--hls-duration` 선택 이유**: Streamlink 표준 플래그인 `--stream-segmented-duration`은
> Chzzk에서 무시됨. Chzzk HLS 구현이 세그먼트 duration 메타데이터를 비표준 방식으로
> 처리하기 때문. 소거법으로 발견. 어떤 공식 문서에도 없는 플랫폼 특화 동작.

**2. YouTube/Generic** (`src/lib/ytdlpDownloader.ts`) — 1-phase:
```bash
# Phase 1: yt-dlp (구간 다운로드 + FFmpeg 통합)
yt-dlp \
  --download-sections "*START-END" \
  -f "bestvideo[height<=?9999]+bestaudio/best" \
  --postprocessor-args "ffmpeg:-avoid_negative_ts make_zero -fflags +genpts -movflags +faststart" \
  --ffmpeg-location /path/to/ffmpeg \
  -N 8 \
  --external-downloader aria2c \
  --external-downloader-args "aria2c:-x 16 -s 16" \
  -o final.mp4 \
  <url>
```
- 화질: 최고 화질 (제한 없음), flexible fallback
- 병렬: `-N 8`, aria2c — **속도 개선 효과 없음** (YouTube 서버 throttle)
- 성능: ~30-32초 (1분 영상)
- SSE phase: `downloading`만 (FFmpeg가 yt-dlp 내부에서 처리됨)

> **`-N` 최적화 한계**: `-N` 값이나 aria2c 연결 수를 늘려도 속도 개선 불가.
> YouTube 서버가 클라이언트 병렬 요청을 throttle하는 것으로 추정.
> 실측: 구간 다운로드 ~6 Mbps vs 전체 다운로드 ~93 Mbps.
> 병목은 클라이언트가 아닌 서버 정책이므로 클라이언트 최적화로 해결 불가.

**클라이언트 측 진행률 가중치** (`src/features/url-input/utils/sseProgressUtils.ts`):
```typescript
const PHASE_WEIGHTS = {
  DOWNLOADING: 0.9,  // 0-90% 표시
  PROCESSING: 0.1,   // 90-100% 표시
};

// Chzzk: downloading(0-90%) + processing(90-100%)
// YouTube: downloading(0-90%) — processing은 없음
```

---

### GET /api/download/:jobId

완료된 다운로드 파일을 다운로드합니다.

**엔드포인트:** `GET /api/download/:jobId`

**응답:** 비디오 파일

**응답 헤더:**
```
Content-Type: video/mp4
Content-Disposition: attachment; filename*=UTF-8''video.mp4
```

**에러 응답:**
```json
{
  "error": "파일을 찾을 수 없습니다"
}
```

**구현 파일:** `src/app/api/download/[jobId]/route.ts`

**내부 로직:**
1. Job 조회 (`getJob`)
2. 파일 존재 확인
3. 파일 스트리밍
4. Job 삭제 (`deleteJob`)

---

## 공통 에러 처리

모든 API는 다음 유틸리티를 사용합니다:

**파일:** `src/lib/apiErrorHandler.ts`

### parseYtdlpError

yt-dlp 에러를 파싱하여 사용자 친화적 메시지 반환.

```typescript
function parseYtdlpError(error: ProcessError): {
  message: string;
  status: number;
}
```

**에러 코드 매핑:**
- `ENOENT` (code) → 500 "yt-dlp를 찾을 수 없습니다"
- `killed` (true) → 504 "요청 시간이 초과되었습니다"
- `Unsupported URL` (stderr) → 400 "지원하지 않는 URL입니다"

### validateTrimRequest / validateDownloadRequest

요청 본문 검증.

```typescript
function validateDownloadRequest(body: unknown):
  | { valid: true; data: DownloadRequestParams }
  | { valid: false; error: string; status: number }
```

**검증 항목:**
- URL 존재 및 문자열 타입
- startTime: 0 이상 숫자
- endTime: startTime보다 큰 숫자
- filename: 문자열

> **참고**: `validateTrimRequest`와 `validateDownloadRequest`는 각각 독립 구현 (공통 helper 없음)

---

## 타입 정의

**파일:** `src/types/sse.ts`

```typescript
// Discriminated Union
export type SSEEvent =
  | SSEProgressEvent
  | SSECompleteEvent
  | SSEErrorEvent;

export interface SSEProgressEvent {
  type: 'progress';
  progress: number;
  processedSeconds: number;
  totalSeconds: number;
  phase: 'downloading' | 'processing' | 'completed';
}

export interface SSECompleteEvent {
  type: 'complete';
  filename: string;
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
}
```

**플랫폼별 phase 발생 패턴:**

| phase | Chzzk | YouTube/Generic |
|-------|-------|-----------------|
| `downloading` | ✅ | ✅ |
| `processing` | ✅ | ❌ (없음) |

---

## 성능 고려사항

### 타임아웃

| API | 타임아웃 | 이유 |
|-----|----------|------|
| /api/video/resolve | 기본 (2분) | yt-dlp 실행 |
| /api/video/proxy | 없음 | 스트리밍 |
| /api/video/trim | 없음 | 응답 스트리밍 |
| /api/download/start | 즉시 | 백그라운드 작업 |
| /api/download/stream | 없음 | SSE 연결 유지 |

### 메모리

- 프록시/스트리밍: chunked transfer로 메모리 효율적
- 다운로드: 임시 파일 사용, 완료 후 자동 삭제
- Job 레지스트리: 메모리 내 저장

### 동시성

- 각 다운로드 작업은 독립 프로세스
- Job별 진행률 추적
- SSE 연결당 1개 스트림

---

## 보안

### CORS

- `/api/video/proxy`: 모든 origin 허용 (필수)
- 나머지: Next.js 기본 설정

### 입력 검증

- URL: 문자열 타입 검증만 (yt-dlp가 유효성 검증)
- 시간: 숫자 타입 및 범위 검증
- 파일명: 사용자 입력 그대로 사용 (Content-Disposition)

### 리소스 제한

- 타임아웃: 프로세스 무한 실행 방지
- 임시 파일: 자동 정리
- Job 레지스트리: 완료 후 삭제

---

## 개발/디버깅

### 로그

모든 API는 콘솔 로그를 출력합니다:

```
[resolve] Error: Unsupported URL
[trim] Phase 1 (Downloading) - offset=00:00:10 duration=00:00:20
[SSE] downloading: 45% (22.5s)
```

### 테스트

```bash
# Resolve API
curl -X POST http://localhost:3000/api/video/resolve \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=..."}'

# Proxy API
curl http://localhost:3000/api/video/proxy?url=<encoded>

# Download API
curl -X POST http://localhost:3000/api/download/start \
  -H "Content-Type: application/json" \
  -d '{"url":"...","startTime":10,"endTime":60,"filename":"test.mp4"}'

# SSE Stream
curl -N http://localhost:3000/api/download/stream/<jobId>
```

---

## cut_video.sh와 TypeScript 구현 비교

**파일**: `scripts/cut_video.sh`

이 스크립트는 **실행되지 않으며**, 디버깅 및 로직 참조 목적으로만 존재합니다. Streamlink + FFmpeg 2단계 프로세스의 원형 증명이며, TypeScript API로 포팅되었습니다.

### 핵심 로직 원형

#### Phase 1: Streamlink 다운로드

```bash
streamlink \
  --hls-start-offset "$START" \
  --stream-segmented-duration "$DUR" \
  "$URL" best -o "temp.mp4"
```

> **참고**: 원본 스크립트는 `--stream-segmented-duration` 사용.
> **현재 구현은 `--hls-duration` 사용** (Chzzk 호환성: `--stream-segmented-duration`이 Chzzk에서 무시됨).

#### Phase 2: FFmpeg 타임스탬프 리셋

```bash
ffmpeg -i "temp.mp4" \
  -c copy \
  -avoid_negative_ts make_zero \
  -fflags +genpts \
  "$OUTPUT"
```

**왜 2단계가 필요한가?**
- Streamlink만 사용: 타임스탬프가 원본 기준 (예: 3:05:24부터 시작)
- 플레이어는 00:00:00부터 기대
- FFmpeg 리셋 후: 타임스탬프가 00:00:00부터 시작

### 쉘 스크립트 vs TypeScript API 비교

| 항목 | 쉘 스크립트 | TypeScript API |
|-----|-----------|---------------|
| **실행** | 로컬 CLI | HTTP 서버 |
| **입출력** | 파일 → 파일 | HTTP → HTTP |
| **진행률** | 콘솔 출력 | SSE 스트림 |
| **에러** | 종료 코드 | HTTP 상태 코드 |
| **의존성** | 시스템 설치 | 번들 + 자동 다운로드 |
| **플랫폼 지원** | Chzzk (Streamlink) | Chzzk + YouTube + Generic |

### TypeScript 포팅 핵심

**입력 방식 변환**:
```bash
# 쉘
START="3:05:24"
END="3:10:21"
```

```typescript
// TypeScript API
{
  "startTime": 11124,  // 3:05:24 → 초 단위
  "endTime": 11421,    // 3:10:21 → 초 단위
}
```

**진행률 표시 변환**:
```bash
# 쉘: 콘솔 출력
log_info "구간 다운로드 시작..."
```

```typescript
// TypeScript: SSE로 실시간 스트리밍
{ type: 'progress', progress: 45, phase: 'downloading' }
{ type: 'complete', filename: 'video.mp4' }
```

---

## 참고 자료

- [yt-dlp 문서](https://github.com/yt-dlp/yt-dlp)
- [Streamlink 문서](https://streamlink.github.io/)
- [FFmpeg 문서](https://ffmpeg.org/documentation.html)
- [Server-Sent Events 스펙](https://html.spec.whatwg.org/multipage/server-sent-events.html)
