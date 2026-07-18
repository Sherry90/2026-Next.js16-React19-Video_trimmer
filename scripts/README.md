# Scripts

프로젝트 관련 스크립트 모음.

## setup-deps.mjs

**목적**: 외부 의존성 바이너리와 FFmpeg.wasm 코어를 자동 준비

**실행**: `npm install` 시 `postinstall` 훅으로 자동 실행

**기능**:
- **번들 Python** (`.bin/python`): 시스템 Python에 의존하지 않도록 astral-sh/python-build-standalone의 고정 버전 하나를 받아 둔다. yt-dlp·streamlink venv가 이 Python을 공용으로 쓴다(버전 통일).
- **yt-dlp**: 우선순위대로 준비 — ① 시스템에 이미 있으면 그대로 사용(예: Docker의 `pip install yt-dlp`) → ② 번들 Python으로 만든 venv(`.bin/yt-dlp-venv`)에 `pip install` → ③ 실패 시 GitHub 릴리스의 고정 onefile 바이너리를 `.bin/`에 다운로드(startup 느림, venv 불가 환경용).
- **streamlink**: 플랫폼별로 `.bin/`에 준비
  - Windows: portable 빌드(.zip)를 받아 `adm-zip`으로 추출
  - Linux: AppImage(x64/ARM64)
  - macOS: 번들 Python venv 자동 생성 후 `pip install streamlink`
- **FFmpeg.wasm**: `@ffmpeg/core`를 `public/ffmpeg/`로 복사 (`copyWasmFiles`, CDN 미사용)

> 런타임 경로 해석(`src/lib/binPaths.ts`)은 번들 venv/바이너리를 시스템 설치보다 우선한다. 설치 단계의 위 우선순위(시스템 먼저 확인)와는 관점이 다르다.

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
