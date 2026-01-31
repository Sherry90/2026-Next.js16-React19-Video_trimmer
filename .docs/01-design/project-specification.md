# Video Trimmer - 초기 프로젝트 명세서

> **역사적 문서** - 초기 설계 및 계획 단계를 나타냅니다
>
> **작성일**: 2026-01-20
> **단계 범위**: 계획 및 Phase 1-6 설계
> **상태**: ✅ 모든 단계 완료 (2026-01-30 기준)
>
> **참고**: 이 문서는 원래 설계 의도를 반영합니다. 개발 중 이루어진 구현 변경 및 개선 사항은 `.docs/02-history/DEVELOPMENT-HISTORY.md`를 참조하세요.

---

## 1. 프로젝트 개요

### 1.1 목적
서버 업로드 없이 브라우저 기반으로 동영상을 트리밍하는 웹 애플리케이션. 모든 처리는 클라이언트 측에서 수행됩니다.

### 1.2 핵심 원칙
- **서버 의존성 없음**: 모든 처리가 클라이언트 측에서 수행됨
- **개인 프로젝트**: 비상업적, 학습 중심
- **점진적 개발**: 6단계로 구현

### 1.3 프로젝트 성격
- 개인 학습 프로젝트
- 상업적 사용 없음
- 현대 웹 기술에 집중

---

## 2. 기술 스택 (초기 설계)

| 기술 | 버전 | 패키지 이름 | 역할 |
|------------|---------|--------------|------|
| Next.js | 16.1.1 | `next@16.1.1` | 프레임워크 |
| React | 19.x | `react@latest` | UI 라이브러리 |
| TypeScript | 5.x | `typescript@latest` | 타입 안전성 |
| Turbopack | 내장 | - | 번들러 (Next.js 16 기본값) |
| React Compiler | 내장 | `babel-plugin-react-compiler` | 자동 메모이제이션 |
| **FFmpeg.wasm** | - | `@ffmpeg/ffmpeg` | **동영상 트리밍 (초기 계획)** ⚠️ |
| Video.js | 8.x | `video.js` | 동영상 재생 |
| wavesurfer.js | 7.x | `wavesurfer.js` | 오디오 파형 (Phase 4) |
| Zustand | 5.x | `zustand` | 상태 관리 |
| Tailwind CSS | 4.x | `tailwindcss` | 스타일링 |
| Vitest | 3.x | `vitest` | 유닛 테스트 (Phase 6) |
| Playwright | 1.x | `@playwright/test` | E2E 테스트 (Phase 6) |

> ⚠️ **중요한 변경 사항**: FFmpeg.wasm은 성능 향상과 스트림 복사 기능을 위해 Phase 6에서 MP4Box.js로 교체되었습니다. 자세한 내용은 `.docs/02-history/DEVELOPMENT-HISTORY.md`를 참조하세요.

### 2.1 설치 명령어

```bash
# 프로젝트 생성
npx create-next-app@16.1.1 video-trimmer --typescript --tailwind --eslint --app --turbopack

# 핵심 의존성
npm install zustand video.js @ffmpeg/ffmpeg  # 참고: FFmpeg은 나중에 교체됨

# React Compiler
npm install -D babel-plugin-react-compiler

# Phase 4 의존성
npm install wavesurfer.js

# Phase 6 의존성 (테스팅)
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test
```

---

## 3. 기술 요구사항

### 3.1 동영상 처리 (원래 계획)
- **방법**: FFmpeg.wasm 트랜스코딩
- **정확도**: 프레임 단위 정확한 트리밍
- **제약 사항**: 느린 처리, 큰 번들 크기
- **COOP/COEP**: SharedArrayBuffer 지원 필요

> **실제 구현**: 속도를 위해 MP4Box.js 스트림 복사로 전환, FFmpeg.wasm은 대체 옵션으로 유지

### 3.2 입력 사양
- **형식**: MP4, WebM, OGG, QuickTime, AVI, MKV
- **크기 제한**: 1GB (구성 가능)
- **검증**: 경고 메시지와 함께 유효하지 않은 파일 거부

### 3.3 출력 사양
- 원본 메타데이터 보존 (품질, 해상도, 코덱)
- 파일명 형식: `{원본}_edited.{확장자}`

### 3.4 브라우저 호환성
- 최신 브라우저 (Chrome, Edge, Firefox, Safari)
- File API 및 Blob 지원 필요
- SharedArrayBuffer 지원 (FFmpeg.wasm용)

---

## 4. 용어

| 용어 (한국어) | 영어 | 설명 |
|---------------|---------|-------------|
| 트리밍 | Trimming | 동영상 자르기 작업 |
| 인 포인트 | In Point | 트리밍 시작 위치 |
| 아웃 포인트 | Out Point | 트리밍 종료 위치 |
| 플레이헤드 | Playhead | 현재 재생 위치 |
| 타임라인 에디터 | Timeline Editor | 트리밍 제어 UI 컴포넌트 |

---

## 5. 애플리케이션 흐름

```
[업로드 화면]
     ↓ 파일 선택/드래그
[업로드 중] ← 파일 업로드 진행률 + FFmpeg 로딩
     ↓ 완료
[편집 화면] ← 동영상 플레이어 + 타임라인 에디터
     ↓ 내보내기 버튼
[처리 중] ← 트리밍 진행률 (0~100%)
     ↓
[완료] → 다운로드 버튼
[오류] → 오류 메시지 표시
```

**Phase 5 추가 사항**:
- 완료/오류 후 → 새 파일 편집, 재시도

---

## 6. 컴포넌트 아키텍처

### 6.1 주요 컴포넌트 (별도 파일)

| 컴포넌트 | 역할 |
|-----------|------|
| Layout | 앱 전체 레이아웃 |
| Upload | 파일 업로드 (드래그 앤 드롭), 진행률 표시 |
| Video Player | Video.js 기반 재생 |
| Timeline Editor | 트리밍 제어 UI |
| Download | 완료된 동영상 다운로드 버튼 |
| Loading | 처리 진행률 표시 |
| Error | 오류 메시지 표시 (개발용) |

### 6.2 화면 전환

1. **초기**: Upload 컴포넌트만
2. **업로드 시작**: 진행률 표시 (파일 + FFmpeg)
3. **완료**: 타임라인 에디터 + 동영상 플레이어
4. **내보내기 클릭**: 트리밍 진행률
5. **처리 완료**: 다운로드 버튼
6. **처리 실패**: 오류 화면

---

## 7. 타임라인 에디터 설계

### 7.1 UI 구조
- **형태**: 가로 바
- **배경**:
  - Phase 2~3: 단색
  - Phase 4: 오디오 파형 (wavesurfer.js), 오디오 없으면 비어 있음
- **가장자리**: 시작 시간 (0) ~ 종료 시간 (동영상 길이)

### 7.2 핸들 (3가지 타입, 시각적으로 구별)

| 핸들 | 초기 위치 | 조작 방법 |
|--------|------------------|--------------|
| In Point | 0초 (동영상 시작) | 드래그 또는 시간 입력 |
| Out Point | 동영상 끝 | 드래그 또는 시간 입력 |
| Playhead | In Point 위치 | 클릭 또는 드래그 |

### 7.3 핸들 제약 조건
- In Point는 Out Point를 초과할 수 없음
- Out Point는 In Point 앞으로 갈 수 없음
- Playhead는 In Point와 Out Point 사이에서만 이동

### 7.4 잠금 기능 (Phase 4)
- In/Out Point 시간 입력 옆에 잠금 아이콘 UI
- 잠금되면 핸들을 이동할 수 없음

### 7.5 재생 동작
- **재생 시작**: 플레이헤드 위치 → Out Point까지
- **재생 종료 후**: 다음 재생은 플레이헤드 위치에서 시작
- **재생 중 플레이헤드 이동**: 새 위치에서 재생 재개

### 7.6 미리보기 옵션

**(A) 전체 세그먼트** (Phase 3):
- In Point → Out Point 재생

**(B) 가장자리 미리보기** (Phase 4):
- 재생: (In Point → In Point +5초) + (Out Point -5초 → Out Point)
- 세그먼트 < 10초인 경우: 전체 세그먼트 재생 (A와 동일)

### 7.7 줌 기능 (Phase 4)
- **컨트롤**: Ctrl + 마우스 휠
- **범위**: 0.1x ~ 10x

### 7.8 키보드 단축키

| 키 | 기능 | Phase |
|-----|----------|-------|
| Space | 재생/일시정지 | 2 |
| ← / → | 프레임 단위 탐색 | 3 |
| Shift + ← / → | 1초 단위 탐색 | 3 |
| I | 플레이헤드에 In Point 설정 | 3 |
| O | 플레이헤드에 Out Point 설정 | 3 |
| Home | In Point로 이동 | 3 |
| End | Out Point로 이동 | 3 |

---

## 8. 진행률 UI 요약

| 단계 | 진행률 표시 | Phase |
|-------|------------------|-------|
| FFmpeg.wasm 다운로드 | ✅ (업로드와 동시) | 2 |
| 파일 업로드 | ✅ | 2 |
| 파형 생성 | ✅ | 4 |
| 트리밍 처리 | ✅ | 2 |

---

## 9. 오류 처리 (개발 단계)

- 원시 오류 메시지 표시
- 개발자 디버깅을 위한 상세 정보 표시
- 초기에는 사용자 친화적인 오류 메시지 없음

---

## 10. 폴더 구조 (기능 기반)

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx            # 메인 페이지
│   └── globals.css         # 전역 스타일
│
├── features/
│   ├── upload/
│   │   ├── components/
│   │   │   ├── UploadZone.tsx
│   │   │   ├── UploadProgress.tsx
│   │   │   └── FileValidationError.tsx
│   │   ├── hooks/
│   │   │   └── useFileUpload.ts
│   │   └── utils/
│   │       └── validateFile.ts
│   │
│   ├── player/
│   │   ├── components/
│   │   │   ├── VideoPlayerView.tsx
│   │   │   └── PlayerControls.tsx
│   │   ├── context/
│   │   │   └── VideoPlayerContext.tsx
│   │   └── hooks/
│   │       └── useVideoPlayer.ts
│   │
│   ├── timeline/
│   │   ├── components/
│   │   │   ├── TimelineEditor.tsx
│   │   │   ├── TimelineBar.tsx
│   │   │   ├── InPointHandle.tsx
│   │   │   ├── OutPointHandle.tsx
│   │   │   ├── Playhead.tsx
│   │   │   ├── TimeInput.tsx
│   │   │   ├── TimeDisplay.tsx
│   │   │   ├── WaveformBackground.tsx  # Phase 4
│   │   │   └── LockButton.tsx          # Phase 4
│   │   ├── hooks/
│   │   │   ├── useTimelineState.ts
│   │   │   ├── useDragHandle.ts
│   │   │   └── useKeyboardShortcuts.ts # Phase 3
│   │   └── utils/
│   │       ├── timeFormatter.ts
│   │       └── constrainPosition.ts
│   │
│   └── export/
│       ├── components/
│       │   ├── ExportButton.tsx
│       │   ├── ExportProgress.tsx
│       │   ├── DownloadButton.tsx
│       │   └── ErrorDisplay.tsx
│       └── utils/
│           ├── trimVideoFFmpeg.ts      # 원래 계획
│           └── generateFilename.ts
│
├── stores/
│   └── useStore.ts         # 단일 Zustand 스토어
│
├── components/             # 공유 컴포넌트
│   ├── Layout.tsx
│   ├── LoadingSpinner.tsx
│   └── ProgressBar.tsx
│
├── hooks/                  # 공유 훅
├── utils/                  # 공유 유틸리티
│   └── formatBytes.ts
│
├── constants/              # 상수
│   ├── fileConstraints.ts
│   └── keyboardShortcuts.ts
│
└── types/                  # 타입 정의
    ├── store.ts
    ├── video.ts
    └── timeline.ts
```

---

## 11. 설계 원칙

- **단일 책임**: 하나의 기능, 하나의 책임
- **세밀한 분리**: 컴포넌트, 유틸리티, 상수를 최대한 분리
- **높은 응집도**: 관련 기능을 그룹화
- **극단적 분리 방지**: 역할/기능별로 분리하되, 임의적이지 않게

---

## 12. 개발 단계

### Phase 1: 프로젝트 설정 및 기본 부트스트랩 ✅ 완료 (2026-01-20)
- [x] Next.js 16 + Turbopack + TypeScript 초기화
- [x] Tailwind CSS 구성
- [x] COOP/COEP 헤더 설정 (FFmpeg.wasm SharedArrayBuffer용)
- [x] Zustand 스토어 구조
- [x] ESLint, Prettier 구성
- [x] 기능 기반 폴더 구조
- [x] 기본 레이아웃 컴포넌트
- [x] 개발 서버 실행 확인
- [x] `tsc --noEmit` 통과

### Phase 2: 핵심 흐름 + 기본 UI ✅ 완료 (2026-01-21)
- [x] 파일 업로드 컴포넌트 (드래그 앤 드롭) + 진행률
- [x] 입력 검증 (형식, 1GB 제한) + 거부 시 경고
- [x] FFmpeg.wasm 로딩 + 진행률 + 캐싱
- [x] Video.js 플레이어 컴포넌트
- [x] 타임라인 에디터 (단색 배경)
  - [x] In Point / Out Point 핸들 (드래그 가능)
  - [x] In Point / Out Point 시간 입력
  - [x] Playhead + 현재 시간 표시
  - [x] 핸들 제약 조건 (In < Out)
  - [x] 시각적으로 구별되는 핸들
- [x] 재생 (Space 키)
- [x] 트리밍 실행 + 진행률
- [x] 다운로드 (`_edited` 접미사)
- [x] 오류 표시 (원시 메시지)
- [x] **버그 수정**: Playhead 스냅백 제거 (commit 23fa7f9)

### Phase 3: 편의 기능 ✅ 완료 (2026-01-21)
- [x] 키보드 단축키 (←→, Shift+←→, I, O, Home, End)
- [x] 미리보기 (A) 전체 세그먼트

### Phase 4: 고급 기능 ✅ 완료 (2026-01-28)
- [x] wavesurfer.js 파형 + 진행률 (오디오 없으면 비어 있음)
- [x] 타임라인 줌 (Ctrl + 휠)
- [x] In/Out Point 잠금 기능
- [x] 미리보기 (B) 가장자리 미리보기 옵션 (개선됨)

### Phase 5: 흐름 완성 ✅ 완료 (2026-01-27)
- [x] 완료 후 새 파일 편집 (DownloadButton의 "다른 파일 편집" 버튼)
- [x] 실패 후 재시도 (ErrorDisplay의 "처음부터 시작" 버튼)

### Phase 6: 테스팅 ✅ 완료 (2026-01-28)
- [x] Vitest 유닛 테스트
  - [x] 유틸리티 함수 (timeFormatter, constrainPosition, validateFile)
  - [x] Zustand 스토어 (모든 상태 관리 로직)
  - [x] 핵심 로직 (91개 테스트 통과)
- [x] Playwright E2E 테스트 설정
  - [x] 테스트 프레임워크 구성
  - [x] 업로드 워크플로 테스트 스켈레톤
  - [x] 에디터 상호작용 테스트 스켈레톤
  - [x] 전체 워크플로 테스트 스켈레톤
  - ⚠️ 실제 동영상 파일이 필요한 테스트는 건너뜀

> **참고**: Phase 6에서 MP4Box.js가 주요 트리밍 방법으로 도입되었으며, FFmpeg.wasm은 대체 옵션으로 유지되었습니다. 자세한 구현 이력은 참조하세요.

---

## 13. 상태 관리 설계 (Zustand)

### 13.1 스토어 구조

```typescript
type AppPhase =
  | 'idle'           // 초기 상태
  | 'uploading'      // 파일 업로드 중
  | 'editing'        // 편집 중
  | 'processing'     // 트리밍 진행 중
  | 'completed'      // 완료
  | 'error';         // 오류 발생

interface VideoFile {
  file: File;
  name: string;
  size: number;
  type: string;
  url: string;           // Object URL
  duration: number;      // 초 단위
}

interface TimelineState {
  inPoint: number;       // 초 단위
  outPoint: number;      // 초 단위
  playhead: number;      // 초 단위
  isInPointLocked: boolean;   // Phase 4
  isOutPointLocked: boolean;  // Phase 4
  zoom: number;          // Phase 4 (1 = 100%)
}

interface ProcessingState {
  uploadProgress: number;     // 0-100
  ffmpegLoadProgress: number; // 0-100 (원래 계획)
  trimProgress: number;       // 0-100
  waveformProgress: number;   // Phase 4, 0-100
}

interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  isMuted: boolean;
}

interface ErrorState {
  hasError: boolean;
  errorMessage: string | null;
  errorCode: string | null;
}

interface ExportState {
  outputUrl: string | null;   // Blob URL
  outputFilename: string | null;
}
```

### 13.2 스토어 액션
- 단계 관리: `setPhase`
- 파일 작업: `setVideoFile`, `setVideoDuration`
- 타임라인 작업: `setInPoint`, `setOutPoint`, `setPlayhead`, 잠금, 줌
- 진행률 업데이트: `setUploadProgress`, `setTrimProgress`, `setWaveformProgress`
- 플레이어 제어: `setIsPlaying`, `setCurrentTime`, `setVolume`, `setIsMuted`
- 오류 처리: `setError`, `clearError`
- 내보내기 결과: `setExportResult`, `clearExportResult`
- 재설정: `reset` (URL.revokeObjectURL 정리 포함)

---

## 14. Git 커밋 컨벤션

> **공식 가이드**: [Udacity Git Commit Message Style Guide](https://udacity.github.io/git-styleguide/)

### 14.1 커밋 메시지 형식

```
<type>: <subject>

<body> (선택 사항)
```

### 14.2 타입 카테고리

| 타입 | 설명 | 사용 사례 |
|------|-------------|----------|
| `feat` | 새 기능 | 새 컴포넌트, 훅, 유틸리티 함수 |
| `fix` | 버그 수정 | 함수 오류, 로직 버그, 타입 오류 |
| `design` | UI/UX 디자인 변경 | CSS, Tailwind 클래스, 레이아웃 조정 |
| `refactor` | 코드 리팩토링 | 동작 변경 없이 코드 구조 개선 |
| `docs` | 문서 업데이트 | README, 주석, 설계 문서 |
| `test` | 테스트 코드 추가/업데이트 | Vitest, Playwright 테스트 |
| `chore` | 기타 변경 사항 | 빌드 구성, 패키지 설치, 구성 파일 |

### 14.3 제목 작성 규칙

1. **50자 이하**, 간결하게
2. **대문자로 시작**, 마침표 없음
3. **명령형 동사** 사용 (Add, Fix, Update, Remove, Refactor)
4. **구체적으로** 변경 사항 명시

```bash
# ✅ 좋은 예
feat: Add UploadZone component with drag-and-drop
fix: Prevent outPoint from exceeding video duration
design: Update timeline handle hover effect
refactor: Extract time formatting logic to utility

# ❌ 나쁜 예
feat: added upload zone  # 소문자, 과거형
fix: bug fix.  # 불명확, 마침표 있음
feat: 업로드 존 추가  # 한국어 (영어 선호)
chore: update files  # 너무 추상적
```

### 14.4 커밋 타이밍 원칙

**✅ 좋은 커밋 타이밍:**
- 하나의 완전한 기능 구현 완료
- 하나의 버그 수정 완료
- 하나의 리팩토링 단위 완료
- 타입 오류 = 0 + Lint 오류 = 0

**❌ 너무 이른 타이밍:**
- 코드가 작동하지 않음
- 타입 오류 존재
- 여러 기능이 혼재됨

**❌ 너무 늦은 타이밍:**
- 여러 기능을 한 번에
- 하루 작업을 한 커밋에

---

## 15. 개발 체크리스트 (필수)

각 Phase 완료 후:

1. **기능 테스트**: Phase 기능이 올바르게 작동하는지 확인
2. **타입 체크**: `tsc --noEmit` 실행, 타입 오류 없는지 확인
3. **Lint 체크**: ESLint 오류 없는지 확인
4. **Git 커밋**: 적절한 컨벤션으로 작동하는 코드 커밋

---

## 16. 참고 문서

### 16.1 공식 문서
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [FFmpeg.wasm Documentation](https://ffmpegwasm.netlify.app) ⚠️ (나중에 MP4Box.js로 교체됨)
- [Video.js Documentation](https://videojs.com/guides)
- [wavesurfer.js Documentation](https://wavesurfer.xyz)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### 16.2 주요 API 참조
- FFmpeg.wasm: `load()`, `writeFile()`, `exec()`, `readFile()` ⚠️ (원래 계획)
- Video.js: `videojs(id, options)`, `player.currentTime()`, `player.duration()`
- wavesurfer.js: `WaveSurfer.create({ container, waveColor, progressColor, url })`
- Zustand: `create<State>()((set, get) => ({ ... }))`

---

## 17. 구현 노트

### 17.1 개발 중 변경된 사항

이 명세서는 2026-01-20 기준 **초기 설계 의도**를 나타냅니다. 구현 중 몇 가지 중요한 변경이 발생했습니다:

1. **MP4Box.js 마이그레이션** (2026-01-28): 성능상의 이유로 FFmpeg.wasm을 대체하여 주요 트리밍 방법으로 사용
2. **하이브리드 접근** (2026-01-29): 정확도가 중요한 시나리오를 위해 FFmpeg.wasm을 대체 옵션으로 유지
3. **주요 리팩토링** (2026-01-30): 6단계 리팩토링으로 코드베이스 787줄 감소 (15.6%)

프로젝트의 진화에 대한 자세한 내용은 `.docs/02-history/DEVELOPMENT-HISTORY.md`를 참조하세요.

### 17.2 이 문서가 중요한 이유

이 초기 명세서는 다음을 위해 보존됩니다:
- **설계 결정 문서화**: 특정 기술이 선택된 이유
- **진화 추적**: 원래 계획과 실제 구현 비교
- **교육적 가치**: 설계 변경 및 트레이드오프로부터 학습
- **새로운 기여자를 위한 맥락**: 프로젝트 기원 이해

---

**명세서 버전**: 1.0 (초기 설계)
**상태**: 역사적 참조
**모든 단계**: ✅ 완료 (2026-01-30 기준)

> 이 문서는 프로젝트에 대한 완전한 이해를 위해 `.docs/03-current/`의 현재 문서와 함께 참조해야 합니다.
