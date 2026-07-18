# Video Trimmer - 문서 인덱스

---

## 목적별 읽기 경로

| 목적               | 읽을 문서                 |
| ------------------ | ------------------------- |
| 아키텍처·설계 파악 | → `01_OVERVIEW.md`        |
| API 연동/호출      | → `02_API.md`             |
| 설치/의존성 관리   | → `03_DEPENDENCIES.md`    |
| 기술 깊이 학습     | → `04_DEVELOPER_GUIDE.md` |

---

## 문서별 설명

### `01_OVERVIEW.md` — 아키텍처 & 설계

**대상**: 프로젝트 구조를 처음 파악하려는 개발자·협업자 (중학생도 읽을 수 있게 쉽게 서술)

이 앱이 **어떤 구조로 만들어졌고 왜 그렇게 만들었는지**를 비유와 함께 설명한다. 레이어드 구조(app/widgets/features/shared), 상태 관리(Zustand + reactive/snapshot 분리), Phase 워크플로, 로컬 자르기 디스패처(MP4Box/FFmpeg.wasm), URL 파이프라인(byte-range/aria2c, SSE), 커스텀 서버 raw bypass, 플레이어-타임라인 동기화, 기술 스택, 성능·한계를 다룬다.

### `02_API.md` — API 레퍼런스

**대상**: 서버 API를 호출하거나 연동 로직을 수정하는 개발자

모든 Next.js API 엔드포인트 스펙. Video API(`/api/video/preview`, `/api/video/resolve`, `/api/video/manifest`, `/api/video/proxy`, `/api/video/waveform`, `/api/video/spectrogram`, `/api/video/trim`)와 Download API(`/api/download/start`, `stream/:jobId`, `:jobId`)의 요청/응답, 플랫폼별 다운로드 전략, SSE 이벤트 타입, 타입 정의, 에러 처리를 다룬다.

### `03_DEPENDENCIES.md` — 외부 의존성 관리

**대상**: 설치·배포 환경을 구성하거나 바이너리 문제를 디버깅하는 개발자

FFmpeg, yt-dlp, Streamlink 세 외부 바이너리의 역할, 번들 방식, 경로 해석 전략. `setup-deps.mjs` 실행 흐름과 플랫폼별(Linux/macOS/Windows) 처리, `binPaths.ts` 경로 관리, FFmpeg.wasm 자체 호스팅, 문제 해결 가이드를 포함한다.

### `04_DEVELOPER_GUIDE.md` — 개발자 학습 가이드

**대상**: 코드 패턴을 심층 학습하고 싶은 개발자

코드베이스를 통해 현대 웹 개발 패턴을 배우는 교육용 문서. 단계별 학습 경로, 핵심 개념(MP4Box, FFmpeg.wasm, HLS, SSE), 디버깅 가이드, 테스팅 전략, 실전 예제를 포함한다. (아키텍처 구조는 `01_OVERVIEW.md` 참조.)

---

## 루트 레벨 문서

- `README.md` — 프로젝트 개요, 설치, 사용법
- `CLAUDE.md` — Claude Code 작업 가이드 (Quick Reference)
- `scripts/README.md` — 스크립트 문서
- `src/lib/README.md` — 서버 유틸 디렉터리 설명
