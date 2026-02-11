# Scripts

프로젝트 관련 스크립트 모음

## setup-deps.mjs

**목적**: 프로젝트 의존성 바이너리 자동 다운로드

**실행**: `npm install` 시 postinstall 훅으로 자동 실행

**기능**:
- yt-dlp 다운로드 (GitHub releases)
- streamlink 다운로드 (플랫폼별)
  - Windows: portable .exe
  - Linux: AppImage (x64/ARM64)
  - macOS: 시스템 설치 권장 (brew install streamlink)

## cut_video.sh (참조용)

**목적**: 원본 쉘 스크립트 참조 자료

**설명**: 이 프로젝트의 URL 트리밍 기능 (`src/app/api/video/trim/route.ts`)은 이 쉘 스크립트의 로직을 TypeScript로 포팅한 것입니다.

**핵심 로직** (2단계 프로세스):
```bash
# Stage 1: streamlink로 세그먼트 다운로드
streamlink --hls-start-offset "$START" \
           --stream-segmented-duration "$DUR" \
           "$URL" best -o "temp.mp4"

# Stage 2: ffmpeg로 타임스탬프 리셋
ffmpeg -i "temp.mp4" \
       -c copy \
       -avoid_negative_ts make_zero \
       -fflags +genpts \
       "$OUTPUT"
```

**TypeScript 구현**: `src/app/api/video/trim/route.ts`의 `trimWithStreamlink()` 함수

**차이점**:
- 쉘: 동기 실행, 사용자 대화형
- TypeScript: 비동기 Promise, HTTP API
- 쉘: 로컬 파일 출력
- TypeScript: 스트림 응답 (Range 지원)

**사용하지 않음**: 이 파일은 실행되지 않으며, 디버깅 및 로직 참조 목적으로만 존재합니다.

## generate-test-video.sh

**목적**: E2E 테스트용 비디오 파일 생성

**사용**: 테스트 환경 설정 시
