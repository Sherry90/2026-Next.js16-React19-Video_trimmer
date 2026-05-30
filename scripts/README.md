# Scripts

프로젝트 관련 스크립트 모음.

## setup-deps.mjs

**목적**: 외부 의존성 바이너리와 FFmpeg.wasm 코어를 자동 준비

**실행**: `npm install` 시 `postinstall` 훅으로 자동 실행

**기능**:
- **yt-dlp**: GitHub 릴리스에서 고정 버전 바이너리를 `.bin/`에 직접 다운로드
- **streamlink**: 플랫폼별로 `.bin/`에 준비
  - Windows: portable 빌드(.zip)를 받아 `adm-zip`으로 추출
  - Linux: AppImage(x64/ARM64)
  - macOS: Python venv 자동 생성 후 `pip install streamlink` (Python 3 미설치 시 경고 후 계속)
- **FFmpeg.wasm**: `@ffmpeg/core`를 `public/ffmpeg/`로 복사 (`copyWasmFiles`, CDN 미사용)

다운로드 실패는 경고만 출력하고 `npm install`을 중단하지 않는다.

## copy-wasm.mjs

**목적**: `@ffmpeg/core`의 `ffmpeg-core.js`/`ffmpeg-core.wasm`을 `public/ffmpeg/`로 복사 (자체 호스팅)

**실행**: `prebuild` 훅 및 `setup-deps.mjs`에서 호출

## cut_video.sh (참조용)

Streamlink + FFmpeg 2단계 트리밍(구간 추출 → 타임스탬프 리셋)의 참조 쉘 구현. **실행되지 않으며** 로직 참조용이다. 서버 구현은 `src/app/api/video/trim/route.ts` 및 `src/lib/streamlinkDownloader.ts`에 있다.

```bash
# Stage 1: streamlink 구간 다운로드
streamlink --hls-start-offset "$START" --hls-duration "$DUR" "$URL" best -o temp.mp4
# Stage 2: ffmpeg 타임스탬프 리셋
ffmpeg -i temp.mp4 -c copy -avoid_negative_ts make_zero -fflags +genpts "$OUTPUT"
```

## docker-build-progress.sh

**목적**: 진행도(`--progress=plain`)를 추적하며 Docker 이미지를 빌드하고 로그를 `.logs/`에 저장

**실행**: `npm run docker:build` / `npm run docker:compose:build`

## generate-test-video.sh

**목적**: E2E 테스트용 비디오 파일 생성
