# Video Trimmer

웹 브라우저에서 동영상을 트리밍할 수 있는 클라이언트 사이드 웹 애플리케이션입니다.

## 주요 기능

- 🎬 브라우저에서 직접 동영상 트리밍 (서버 업로드 없음)
- ⚡ MP4Box.js를 사용한 스트림 복사 트리밍 (재인코딩 없음)
- 🎨 Video.js 기반 비디오 플레이어
- 🎵 wavesurfer.js를 사용한 오디오 파형 시각화
- ⌨️ 키보드 단축키 지원
- 🔒 In/Out Point 잠금 기능
- 🔍 타임라인 줌 (Ctrl + 휠)

## 기술 스택

- **Framework**: Next.js 16 with Turbopack
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS
- **Video Processing**: MP4Box.js (GPAC MP4 Parser/Muxer)
- **Video Player**: Video.js
- **Audio Visualization**: wavesurfer.js
- **State Management**: Zustand
- **Testing**: Vitest (Unit), Playwright (E2E)

## 시작하기

### 설치

```bash
npm install
```

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 앱을 확인하세요.

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
docker run --rm -p 443:443 \
  -v "$PWD/certificates:/app/certificates:ro" \
  -e HOSTNAME=0.0.0.0 \
  -e APP_URL=https://trimvideo.net \
  video-trimmer
```

브라우저에서 `https://trimvideo.net`으로 접속할 수 있습니다.

현재 Docker Compose 구성은 컨테이너의 `443/tcp`를 호스트의 `443/tcp`에 바인딩합니다. 따라서 외부에서는 다음 조건이 맞으면 `https://trimvideo.net`으로 접근할 수 있습니다.

- DNS의 `trimvideo.net` A/AAAA 레코드가 이 Docker 호스트의 공인 IP를 가리켜야 합니다.
- 서버 방화벽, 공유기, 클라우드 보안 그룹에서 인바운드 `443/tcp`가 열려 있어야 합니다.
- `./certificates/trimvideo.net.pem`과 `./certificates/trimvideo.net-key.pem`이 있어야 합니다. 현재 저장소의 로컬 개발 인증서는 mkcert 인증서라, 접속하는 클라이언트가 해당 mkcert CA를 신뢰하지 않으면 브라우저 인증서 경고가 표시됩니다. 공개 서비스라면 Let's Encrypt 같은 공인 인증서로 교체하세요.

로컬 테스트만 할 때는 호스트에서 `https://localhost`로 접속하거나, `/etc/hosts`에 Docker 호스트 IP와 `trimvideo.net`을 매핑한 뒤 `https://trimvideo.net`으로 접속할 수 있습니다.

참고:
- Docker 빌드는 `npm ci --ignore-scripts`로 `postinstall`의 외부 바이너리 다운로드를 건너뜁니다.
- 대신 이미지 안에서 `ffmpeg`, `yt-dlp`, `streamlink`를 시스템 레벨로 설치합니다.
- 프로덕션 빌드는 안정성을 위해 webpack 경로(`next build --webpack`)를 사용합니다.
- Next standalone 출력을 사용해 최종 이미지 크기와 export 시간을 줄입니다.
- progress 스크립트는 `--progress=plain`을 사용하고 로그를 `.logs/`에 저장합니다.

### Docker Compose

빌드 및 실행:

```bash
docker compose up --build
```

빌드 진행도 추적:

```bash
npm run docker:compose:build
```

백그라운드 실행:

```bash
docker compose up --build -d
```

중지:

```bash
docker compose down
```


## 테스트

### 단위 테스트

```bash
# 테스트 실행
npm test

# 테스트 UI
npm run test:ui

# 커버리지 리포트
npm run test:coverage
```

### E2E 테스트

```bash
# E2E 테스트 실행
npm run test:e2e

# E2E 테스트 UI
npm run test:e2e:ui
```

**참고**: 대부분의 E2E 테스트는 실제 비디오 파일이 필요하여 현재 skip 처리되어 있습니다.

## 키보드 단축키

| 키 | 기능 |
|----|------|
| Space | 재생/일시정지 |
| ← / → | 프레임 단위 이동 |
| Shift + ← / → | 1초 단위 이동 |
| I | 현재 위치에 In Point 설정 |
| O | 현재 위치에 Out Point 설정 |
| Home | In Point로 이동 |
| End | Out Point로 이동 |
| Ctrl + 휠 | 타임라인 줌 |

## 지원 포맷

- MP4 (video/mp4)
- WebM (video/webm)
- OGG (video/ogg)
- QuickTime (video/quicktime)
- AVI (video/x-msvideo)
- MKV (video/x-matroska)

**처리 방식**: 스트림 복사 (재인코딩 없음)
- 원본 화질 유지
- 키프레임 기반 트리밍 (1-2초 정확도)
- 빠른 처리 속도
- 파일 크기 제한 없음

## 브라우저 지원

- 최신 웹 브라우저 (Chrome, Edge, Firefox, Safari 등)
- File API 및 Blob 지원 필수

## 개발 과정

이 프로젝트는 Phase별로 점진적으로 개발되었습니다:

- ✅ **Phase 1-6**: 프로젝트 설정부터 테스트까지 완료 (2026-01-20 ~ 2026-01-28)
- ✅ **MP4Box Migration**: FFmpeg → MP4Box 전환 (10-20x 속도 향상, 2026-01-28)
- ✅ **Accuracy Improvement**: FFmpeg 정확도 개선 ±0.5s → ±0.02s (2026-01-28)
- ✅ **Feature Enhancements**: 하이브리드 트리머, 에러 핸들링 강화 (2026-01-29)
- ✅ **Refactoring**: 6단계 리팩토링 완료 (787줄 감소, 2026-01-30)

**현재 상태**: 프로덕션 준비 완료 (4,252줄, 92개 테스트 통과)

## 문서

프로젝트 문서는 `.docs/` 디렉토리에 체계적으로 정리되어 있습니다:

### 📁 `.docs/01-design/` - 초기 설계
- `project-specification.md` - 초기 설계 문서 (역사적 기록)

### 📁 `.docs/02-history/` - 개발 과정
- `DEVELOPMENT-HISTORY.md` - 전체 개발 히스토리 (2026-01-21 ~ 2026-01-30)

### 📁 `.docs/03-current/` - 현재 상태
- `PROJECT-STATUS.md` - **프로젝트 현황** (메인 문서)
- `ARCHITECTURE.md` - 기술 아키텍처 상세
- `FUTURE-IMPROVEMENTS.md` - 향후 개선 계획

### 🤖 개발 가이드
- `CLAUDE.md` - Claude Code를 위한 개발 가이드
- `TESTING.md` - 테스트 가이드

**추천 읽기 순서**: PROJECT-STATUS.md → ARCHITECTURE.md → DEVELOPMENT-HISTORY.md

## 라이센스

ISC

## 기여

이 프로젝트는 개인 학습 프로젝트입니다.
