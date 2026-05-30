# /src/lib - 서버 전용 유틸리티

이 디렉토리는 **Node.js API에 의존하는 서버 전용 코드**를 포함합니다.

## 파일 목록

### 바이너리 관리
- **binPaths.ts** - FFmpeg, yt-dlp, Streamlink 바이너리 경로 해석 (번들 > 시스템 우선순위)

### 프로세스 관리
- **processUtils.ts** - child_process 타임아웃 실행/종료 처리
- **progressParser.ts** - 진행률 파싱 (Streamlink 세그먼트 기반, FFmpeg `-progress` 출력)

### 다운로드 (플랫폼 전략)
- **downloadJob.ts** - SSE 다운로드 Job 오케스트레이터 (플랫폼 감지 → 전략 선택, Job 레지스트리/스트림)
- **platformDetector.ts** - 도메인 기반 플랫폼 감지 (chzzk / youtube / generic)
- **streamlinkDownloader.ts** - Chzzk 다운로더 (Streamlink 2-phase)
- **ytdlpDownloader.ts** - YouTube/Generic 다운로더 (yt-dlp 1-phase)
- **downloadTypes.ts** - `DownloadProgressTracker` 등 다운로더 공통 타입/클래스

### 형식 선택 / 프록시
- **formatSelector.ts** - yt-dlp JSON에서 최적 스트림 선택 (HLS muxed > HTTPS muxed)
- **hlsProxy.ts** - m3u8 내부 세그먼트/플레이리스트 URI를 프록시 경유로 재작성 (CORS)

### Cleanup / 스트리밍
- **cleanup.ts** - Cleanup 함수 레지스트리 (의존성 역전 — Store가 Features에 직접 의존하지 않게 함)
- **streamUtils.ts** - 파일 스트리밍 유틸 (`Content-Disposition` 등 헤더 제어)

## 주의사항

⚠️ **클라이언트 코드에서 import 금지**

이 디렉토리의 코드는 Node.js API를 사용하므로 브라우저에서 실행할 수 없습니다.
클라이언트에서 사용할 유틸리티는 `/src/utils`에 위치시키세요.

## 사용 예시

```typescript
// ✅ API route에서 사용 (서버)
import { getFfmpegPath } from '@/lib/binPaths';

// ❌ 클라이언트 컴포넌트에서 사용 금지
'use client';
import { getFfmpegPath } from '@/lib/binPaths'; // 에러 발생
```
