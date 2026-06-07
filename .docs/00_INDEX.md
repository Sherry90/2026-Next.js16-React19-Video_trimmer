# Video Trimmer - 문서 인덱스

---

## 목적별 읽기 경로

| 목적 | 읽을 문서 |
|------|----------|
| 프로젝트 전체 파악 | → `01_OVERVIEW.md` |
| API 연동/호출 | → `02_API.md` |
| 설치/의존성 관리 | → `03_DEPENDENCIES.md` |
| 기술 깊이 학습 | → `04_DEVELOPER_GUIDE.md` |

---

## 문서별 설명

### `01_OVERVIEW.md` — 프로젝트 기술 개요

**대상**: 처음 프로젝트를 파악하려는 개발자, 아키텍처를 이해하려는 협업자

프로젝트의 전체 그림. 기술 스택, 레이어 구조(features / widgets / shared), Phase 기반 워크플로, 비디오 처리 흐름(로컬 파일 / URL 스트리밍 에디터), 플레이어-타임라인 동기화, 메모리 관리, 번들 전략, 성능 특성, 제약사항을 다룬다.

### `02_API.md` — API 레퍼런스

**대상**: 서버 API를 호출하거나 연동 로직을 수정하는 개발자

모든 Next.js API 엔드포인트 스펙. Video API(`/api/video/resolve`, `/api/video/proxy`, `/api/video/waveform`, `/api/video/trim`)와 Download API(`/api/download/start`, `stream/:jobId`, `:jobId`)의 요청/응답, 플랫폼별 다운로드 전략, SSE 이벤트 타입, 타입 정의, 에러 처리를 다룬다.

### `03_DEPENDENCIES.md` — 외부 의존성 관리

**대상**: 설치·배포 환경을 구성하거나 바이너리 문제를 디버깅하는 개발자

FFmpeg, yt-dlp, Streamlink 세 외부 바이너리의 역할, 번들 방식, 경로 해석 전략. `setup-deps.mjs` 실행 흐름과 플랫폼별(Linux/macOS/Windows) 처리, `binPaths.ts` 경로 관리, FFmpeg.wasm 자체 호스팅, 문제 해결 가이드를 포함한다.

### `04_DEVELOPER_GUIDE.md` — 개발자 학습 가이드

**대상**: 코드 패턴을 심층 학습하고 싶은 개발자

코드베이스를 통해 현대 웹 개발 패턴을 배우는 교육용 문서. 단계별 학습 경로, 아키텍처 심층 분석, 핵심 개념(MP4Box, FFmpeg.wasm, HLS, SSE), 디버깅 가이드, 테스팅 전략, 실전 예제를 포함한다.

---

## 루트 레벨 문서

- `README.md` — 프로젝트 개요, 설치, 사용법
- `CLAUDE.md` — Claude Code 작업 가이드 (Quick Reference)
- `scripts/README.md` — 스크립트 문서
- `src/lib/README.md` — 서버 유틸 디렉터리 설명
