# Video Trimmer

웹 브라우저에서 동영상을 트리밍할 수 있는 클라이언트 사이드 웹 애플리케이션입니다.

## 주요 기능

- 🎬 브라우저에서 직접 동영상 트리밍 (서버 업로드 없음)
- ⚡ FFmpeg.wasm을 사용한 빠른 처리
- 🎨 Video.js 기반 비디오 플레이어
- 🎵 wavesurfer.js를 사용한 오디오 파형 시각화
- ⌨️ 키보드 단축키 지원
- 🔒 In/Out Point 잠금 기능
- 🔍 타임라인 줌 (Ctrl + 휠)

## 기술 스택

- **Framework**: Next.js 16 with Turbopack
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS
- **Video Processing**: FFmpeg.wasm
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

**최대 파일 크기**: 1GB

## 브라우저 지원

- Chromium 기반 브라우저 (Chrome, Edge, Brave 등)
- SharedArrayBuffer 지원 필수

## 개발 과정

이 프로젝트는 Phase별로 점진적으로 개발되었습니다:

- ✅ **Phase 1**: 프로젝트 설정 및 기본 구동
- ✅ **Phase 2**: 핵심 흐름 + 기본 UI
- ✅ **Phase 3**: 편의 기능 (키보드 단축키)
- ✅ **Phase 4**: 고급 기능 (파형, 줌, 잠금, 미리보기)
- ✅ **Phase 5**: 흐름 완성 (새 파일 편집, 재시도)
- ✅ **Phase 6**: 테스트 (Vitest, Playwright)

자세한 내용은 `.docs` 디렉토리의 문서를 참고하세요.

## 라이센스

ISC

## 기여

이 프로젝트는 개인 학습 프로젝트입니다.
