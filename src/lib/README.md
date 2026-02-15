# /src/lib - 서버 전용 유틸리티

이 디렉토리는 **Node.js API에 의존하는 서버 전용 코드**를 포함합니다.

## 파일 목록

### 바이너리 관리
- **binPaths.ts** / **binPaths.cjs** - FFmpeg, yt-dlp, Streamlink 바이너리 경로 관리
  - 번들 바이너리와 시스템 바이너리 우선순위 관리
  - CommonJS와 ESM 버전 모두 제공

### 프로세스 관리
- **processUtils.ts** - child_process 관련 유틸리티
  - 타임아웃 기반 프로세스 실행
  - 프로세스 종료 처리

- **progressParser.ts** - FFmpeg/Streamlink 진행률 파싱
  - StreamlinkProgressParser: 세그먼트 기반 진행률 계산
  - FFmpegProgressTracker: FFmpeg 출력 파싱

### 다운로드 관리
- **downloadJob.ts** - SSE 기반 다운로드 작업 관리
  - Job 레지스트리 및 스트리밍
  - 2단계 다운로드: Streamlink → FFmpeg 타임스탬프 리셋

### 형식 선택
- **formatSelector.ts** - yt-dlp JSON 응답에서 최적 스트림 선택
  - HLS muxed > HTTPS muxed 우선순위

### Cleanup
- **cleanup.ts** - Cleanup 함수 레지스트리
  - 의존성 역전 패턴 적용
  - Store가 Features에 직접 의존하지 않도록 함

### 스트리밍
- **streamUtils.ts** - 파일 스트리밍 유틸리티
  - ReadableStream 생성 및 관리

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
