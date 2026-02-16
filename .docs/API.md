# API Documentation

Video Trimmer의 모든 API 엔드포인트에 대한 상세 문서입니다.

## 목차

- [Video API](#video-api)
  - [POST /api/video/resolve](#post-apivideoresolve)
  - [GET /api/video/proxy](#get-apivideoproxy)
  - [POST /api/video/trim](#post-apivideotrim)
- [Download API (SSE)](#download-api-sse)
  - [POST /api/download/start](#post-apidownloadstart)
  - [GET /api/download/stream/:jobId](#get-apidownloadstreamjobid)
  - [GET /api/download/:jobId](#get-apidownloadjobid)

---

## Video API

### POST /api/video/resolve

YouTube, Twitch 등의 URL에서 스트리밍 정보를 추출합니다.

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

### POST /api/video/trim

URL 기반 비디오를 서버 사이드에서 트리밍합니다.

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

**응답 헤더:**
```
Content-Type: video/mp4
Content-Disposition: attachment; filename*=UTF-8''trimmed.mp4
```

**에러 응답:**
```json
{
  "error": "에러 메시지"
}
```

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

**왜 2단계인가?**
- Streamlink만 사용: 타임스탬프가 원본 기준 (0부터 시작하지 않음)
- FFmpeg 타임스탬프 리셋 필요: `-avoid_negative_ts make_zero`

**타임아웃:**
- Streamlink: 5분
- FFmpeg: 1분

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
3. `startDownloadJob` 백그라운드 실행
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
- `downloading`: 플랫폼별 다운로더 실행 (0-100%)
  - Chzzk: Streamlink (HLS 세그먼트 병렬 다운로드)
  - YouTube: yt-dlp (`--download-sections` 구간 추출)
  - Generic: yt-dlp (fallback)
- `processing`: FFmpeg 타임스탬프 리셋 (0-100%)
- `completed`: 작업 완료

**클라이언트 사용법:**
```typescript
const eventSource = new EventSource(`/api/download/stream/${jobId}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'progress') {
    console.log(`${data.phase}: ${data.progress}%`);
  } else if (data.type === 'complete') {
    eventSource.close();
    window.location.href = `/api/download/${jobId}`;
  } else if (data.type === 'error') {
    console.error(data.message);
    eventSource.close();
  }
};
```

**구현 파일:** `src/app/api/download/stream/[jobId]/route.ts`

**내부 로직:**
1. Job 스트림 구독 (`getJobStream`)
2. ReadableStream 생성
3. 이벤트를 SSE 형식으로 변환
4. 스트림 반환

**Platform Strategy (2026-02-15)**:

다운로드 작업은 URL 도메인에 따라 적절한 전략을 자동 선택합니다:

```typescript
// src/lib/platformDetector.ts
detectPlatform(url: string): 'chzzk' | 'youtube' | 'generic'
selectDownloadStrategy(platform, streamType): 'streamlink' | 'ytdlp'
```

**플랫폼별 다운로더**:

1. **Chzzk** (`src/lib/streamlinkDownloader.ts`):
   - Phase 1: `streamlink --hls-start-offset + --hls-duration` → temp file
   - Phase 2: `ffmpeg -avoid_negative_ts make_zero -c copy` → final file
   - 병렬 다운로드: `--stream-segment-threads 6`
   - 성능: 15-20초 (1분 영상)

2. **YouTube** (`src/lib/ytdlpDownloader.ts`):
   - Phase 1: `yt-dlp --download-sections "*START-END" -f "bestvideo[height<=?9999]+bestaudio/best"` → temp file
   - Phase 2: `ffmpeg -avoid_negative_ts make_zero -c copy` → final file
   - 병렬 다운로드: `-N 8` (concurrent fragments), aria2c (`-x 16 -s 16`)
   - 화질: 최고 화질 (제한 없음), flexible fallback
   - 성능: 30-40초 (1분 영상, FFmpeg 구간 추출이 병목)

3. **Generic** (기타 URL):
   - yt-dlp 사용 (YouTube와 동일한 방식)

**공통 패턴**:
- 모든 다운로더는 2-phase process 사용
- SSE를 통한 실시간 진행률 전송
- Fast-fail error handling (명확한 에러 메시지, fallback 없음)

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

**파일:** `src/utils/apiUtils.ts`

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
function validateTrimRequest(body: unknown):
  | { valid: true; data: TrimRequestParams }
  | { valid: false; error: string; status: number }
```

**검증 항목:**
- URL 존재 및 문자열 타입
- startTime: 0 이상 숫자
- endTime: startTime보다 큰 숫자
- filename: 문자열 (Download API만)

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
- Job 레지스트리: 메모리 내 저장 (향후 Redis 고려)

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

## 참고 자료

- [yt-dlp 문서](https://github.com/yt-dlp/yt-dlp)
- [Streamlink 문서](https://streamlink.github.io/)
- [FFmpeg 문서](https://ffmpeg.org/documentation.html)
- [Server-Sent Events 스펙](https://html.spec.whatwg.org/multipage/server-sent-events.html)
