# /src/lib - 서버 전용 유틸리티

이 디렉토리는 **Node.js API에 의존하는 서버 전용 코드**를 포함합니다.

## 파일 목록

### 바이너리 관리
- **binPaths.ts** - FFmpeg, yt-dlp, Streamlink, aria2c 바이너리 경로 해석
  (yt-dlp: venv > 시스템 > 번들 onefile / ffmpeg·streamlink·aria2c: 번들 > 시스템)

### 프로세스 관리
- **processUtils.ts** - child_process 타임아웃 실행 처리 (`runWithTimeout`)
- **progressParser.ts** - 진행률 파싱 (`FFmpegProgressTracker`, `YtdlpProgressParser`).
  Streamlink 진행률은 파일 크기 폴링으로 처리(streamlinkDownloader)라 전용 파서 없음

### API 헬퍼
- **apiUtils.ts** - 요청 검증(`validateTrimRequest`/`validateDownloadRequest`,
  공통 `validateTimeRange`), yt-dlp 에러 파싱, 표준 에러 응답

### 다운로드 (플랫폼 전략)
- **downloadJob.ts** - SSE 다운로드 Job 오케스트레이터 (플랫폼 감지 → 전략 선택, Job 레지스트리/스트림)
- **platformDetector.ts** - 도메인 기반 플랫폼 감지 (chzzk / youtube / generic)
- **streamlinkDownloader.ts** - Chzzk 다운로더 (Streamlink 2-phase)
- **ytdlpDownloader.ts** - YouTube/Generic 다운로더 (byte-range 우선 → 전체 다운로드+로컬 컷 폴백)
- **byteRangeDownloader.ts** - DASH `sidx` 파싱 → 구간 바이트만 Range 수신 후 로컬 ffmpeg 컷
- **downloadTypes.ts** - `DownloadProgressTracker` 등 다운로더 공통 타입/클래스
- **errorReport.ts** - 서버 다운로드 실패 리포팅 (`reportServerError`)

### DASH / 형식 선택 / 프록시
- **dashManifest.ts** - DASH MPD 매니페스트 생성 (`buildMpd`, SegmentBase + indexRange)
- **manifestStore.ts** - 생성된 MPD 임시 저장 (`/api/video/manifest`가 same-origin으로 서빙)
- **formatSelector.ts** - yt-dlp JSON에서 최적 스트림/DASH 표현 선택 (HLS muxed > HTTPS muxed, avc1+mp4a)
- **hlsProxy.ts** - m3u8 내부 세그먼트/플레이리스트 URI를 프록시 경유로 재작성 (CORS)

### 스펙트럼 / Cleanup / 스트리밍
- **spectrogramCompute.ts** - PCM → STFT 스펙트로그램 프레임 연산 (`shared/lib/spectrogram.ts` 공유)
- **cleanup.ts** - Cleanup 함수 레지스트리 (의존성 역전 — Store가 Features에 직접 의존하지 않게 함)
- **streamUtils.ts** - 파일 스트리밍 유틸 (`Content-Disposition` 등 헤더 제어)

## 주의사항

⚠️ **클라이언트 코드에서 import 금지**

이 디렉토리의 코드는 Node.js API를 사용하므로 브라우저에서 실행할 수 없습니다.
클라이언트/공유 순수 유틸리티는 `/src/shared/lib`에 위치시키세요 (`/src/utils`는 제거됨).

## 사용 예시

```typescript
// ✅ API route에서 사용 (서버)
import { getFfmpegPath } from '@/lib/binPaths';

// ❌ 클라이언트 컴포넌트에서 사용 금지
'use client';
import { getFfmpegPath } from '@/lib/binPaths'; // 에러 발생
```
