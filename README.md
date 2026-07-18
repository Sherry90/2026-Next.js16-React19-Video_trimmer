# Video Trimmer

웹 브라우저에서 동영상을 트리밍하는 클라이언트 사이드 웹 애플리케이션. 로컬 파일은 서버 업로드 없이 브라우저에서 직접 처리하고, URL 영상(YouTube·치지직 등)은 다운로드 전에 스트림 위에서 구간을 정한 뒤 확정 구간만 서버에서 받아 디스크로 직행 전달한다.

## 주요 기능

- 🎬 **로컬 파일**: 서버 업로드 없이 브라우저에서 직접 트리밍 (14개 형식)
- 🌐 **URL 영상**: 스트리밍 에디터 — 다운로드 전 스트림 위에서 구간 편집, 확정 시 서버 구간 다운로드(SSE)
- ⚡ **하이브리드 트리밍**: 형식에 따라 MP4Box.js(빠름) / FFmpeg.wasm(정밀) 자동 선택
- 🎨 **video.js** 기반 플레이어 (HLS/DASH 재생 지원)
- 🎵 **wavesurfer.js** 오디오 파형 (URL 소스는 서버 peaks)
- ⌨️ 키보드 단축키, In/Out Point 잠금, 타임라인 줌(휠)
- 🔎 가장자리 미리보기(처음 5초 + 마지막 5초)

## 기술 스택

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS
- **State**: Zustand (단일 스토어 + selector)
- **Video**: MP4Box.js, FFmpeg.wasm, video.js, wavesurfer.js
- **Server tools**: yt-dlp, streamlink, aria2c, ffmpeg (자동 다운로드)
- **Testing**: Vitest (Unit), Playwright (E2E)

## 시작하기

### 설치

```bash
npm install
```

`postinstall` 훅(`scripts/setup-deps.mjs`)이 ffmpeg·yt-dlp·streamlink 바이너리와 FFmpeg.wasm 코어를 자동으로 준비한다.

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 연다.

### 빌드

```bash
npm run build
npm start
```

### Docker

이미지 빌드:

```bash
docker build -t video-trimmer .
```

진행도 추적 빌드:

```bash
npm run docker:build
```

컨테이너 실행:

```bash
docker run --rm -p 3443:3443 \
  -v "$PWD/certificates:/app/certificates:ro" \
  -e HOSTNAME=0.0.0.0 \
  -e APP_URL=https://trimvideo.net:3443 \
  video-trimmer
```

컨테이너는 비루트로 실행되며 비특권 포트 `3443/tcp`를 사용합니다(`Dockerfile`의 `PORT=3443`/`EXPOSE 3443`).

Docker Compose 구성은 호스트의 `${HOST_PORT:-3443}`을 컨테이너의 `3443/tcp`에 바인딩합니다. 외부 접근 조건:

- DNS의 `trimvideo.net` A/AAAA 레코드가 이 Docker 호스트의 공인 IP를 가리켜야 합니다.
- 서버 방화벽, 공유기, 클라우드 보안 그룹에서 인바운드 `3443/tcp`(또는 지정한 `HOST_PORT`)가 열려 있어야 합니다.
- `./certificates/trimvideo.net.pem`과 `./certificates/trimvideo.net-key.pem`이 있어야 합니다. 현재 저장소의 로컬 개발 인증서는 mkcert 인증서라, 접속하는 클라이언트가 해당 mkcert CA를 신뢰하지 않으면 브라우저 인증서 경고가 표시됩니다. 공개 서비스라면 Let's Encrypt 같은 공인 인증서로 교체하세요.
- 80/443 표준 포트로 노출하려면 리버스 프록시를 앞단에 두거나 `HOST_PORT`를 조정하세요.

로컬 테스트만 할 때는 호스트에서 `https://localhost:3443`으로 접속하거나, `/etc/hosts`에 Docker 호스트 IP와 `trimvideo.net`을 매핑한 뒤 `https://trimvideo.net:3443`으로 접속할 수 있습니다.

참고:
- Docker 빌드는 `npm ci --ignore-scripts`로 `postinstall`의 외부 바이너리 다운로드를 건너뜁니다.
- 대신 이미지 안에서 `ffmpeg`, `yt-dlp`, `streamlink`를 시스템 레벨로 설치합니다.
- 프로덕션 빌드는 안정성을 위해 webpack 경로(`next build --webpack`)를 사용합니다.
- Next standalone 출력을 사용해 최종 이미지 크기와 export 시간을 줄입니다.
- progress 스크립트는 `--progress=plain`을 사용하고 로그를 `.logs/`에 저장합니다.

### Docker Compose

```bash
docker compose up --build        # 빌드 및 실행
npm run docker:compose:build     # 빌드 진행도 추적
docker compose up --build -d     # 백그라운드 실행
docker compose down              # 중지
```

## 테스트

```bash
npm test               # Vitest 유닛 테스트
npm run test:ui        # Vitest UI
npm run test:coverage  # 커버리지 리포트
npm run test:e2e       # Playwright E2E
npm run test:e2e:ui    # Playwright UI
```

**참고**: 대부분의 E2E 테스트는 실제 비디오 파일이 필요하여 skip 처리되어 있습니다.

## 키보드 단축키 (편집 화면)

| 키 | 기능 |
|----|------|
| Space | 재생/일시정지 |
| I / O | In / Out Point 설정 |
| ← / → | 1프레임 이동 (1/30초) |
| Shift + ← / → | 1초 이동 |
| Home / End | In / Out Point로 점프 |
| A | 미리보기(선택 구간 재생) |
| 휠 | 타임라인 줌 (1x ~ 10x, 커서 기준) |
| Shift + 휠 | 타임라인 가로 패닝 (줌 > 1일 때) |

단축키는 입력 필드 포커스 시 비활성화된다.

## 지원 포맷

입력 14종: MP4, WebM, OGG, MOV, M4V, AVI, WMV, MKV, FLV, TS, 3GP, 3G2, MPEG, MPG.

**처리 방식**: stream copy(재인코딩 없음)로 원본 화질 유지.
- ISO 형식(MP4/MOV/M4V) → MP4Box.js (±1-2초, 키프레임 기반, 빠름)
- 그 외 형식 → FFmpeg.wasm (±0.02초, 정밀)
- 출력은 입력 형식 유지

## 브라우저 지원

- 최신 브라우저 (Chrome/Edge 90+, Firefox 88+, Safari 14+)
- File API, Blob URL, ES2020+ 필요

## 문서

프로젝트 문서는 `.docs/` 디렉터리에 정리되어 있다.

| 문서 | 내용 |
|------|------|
| `.docs/00_INDEX.md` | 문서 인덱스 |
| `.docs/01_OVERVIEW.md` | 아키텍처 & 설계 |
| `.docs/02_API.md` | API 레퍼런스 |
| `.docs/03_DEPENDENCIES.md` | 외부 의존성 관리 |
| `.docs/04_DEVELOPER_GUIDE.md` | 개발자 학습 가이드 |

루트의 `CLAUDE.md`는 Claude Code 작업용 Quick Reference다.

**추천 읽기 순서**: `01_OVERVIEW` → `02_API` → `03_DEPENDENCIES` → `04_DEVELOPER_GUIDE`

## 라이센스

ISC
