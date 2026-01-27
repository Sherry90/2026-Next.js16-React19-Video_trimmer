# 웹 동영상 트리밍 앱 - 구현 설계서

> **버전**: 2.0.0
> **최종 수정일**: 2026-01-28
> **프로젝트 위치**: `/Users/pc/Documents/study/Video_Trimmer`
> **주요 변경**: FFmpeg.wasm → MP4Box.js 스트림 복사 방식으로 전환

---

## 1. 프로젝트 개요

### 1.1 목적
브라우저에서 동영상을 업로드하고 트리밍하여 다운로드하는 클라이언트 사이드 웹 앱

### 1.2 핵심 원칙
- **서버 의존성 없음**: 모든 처리는 클라이언트에서 수행
- **개인 프로젝트**: 상업용이 아닌 학습/개인 목적
- **점진적 개발**: Phase 1~6으로 단계적 구현

### 1.3 지원 브라우저
- 최신 웹 브라우저 (Chrome, Edge, Firefox, Safari 등)
- File API 및 Blob 지원 필수

---

## 2. 기술 스택 (확정)

| 기술 | 버전 | 패키지명 | 역할 |
|------|------|----------|------|
| Next.js | 16.1.1 | `next@16.1.1` | 프레임워크 |
| React | 19.x | `react@latest` | UI 라이브러리 |
| TypeScript | 5.x | `typescript@latest` | 타입 안정성 |
| Turbopack | 내장 | - | 번들러 (Next.js 16 기본) |
| React Compiler | 내장 | `babel-plugin-react-compiler` | 자동 메모이제이션 |
| MP4Box.js | 2.x | `mp4box` | 동영상 트리밍 (스트림 복사) |
| Video.js | 8.x | `video.js` | 동영상 재생 |
| wavesurfer.js | 7.x | `wavesurfer.js` | 오디오 파형 (Phase 4) |
| Zustand | 5.x | `zustand` | 상태 관리 |
| Tailwind CSS | 4.x | `tailwindcss` | 스타일링 |
| Vitest | 3.x | `vitest` | 단위 테스트 (Phase 6) |
| Playwright | 1.x | `@playwright/test` | E2E 테스트 (Phase 6) |

### 2.1 의존성 설치 명령어

```bash
# 프로젝트 생성
npx create-next-app@16.1.1 video-trimmer --typescript --tailwind --eslint --app --turbopack

# 핵심 의존성
npm install zustand video.js mp4box

# React Compiler
npm install -D babel-plugin-react-compiler

# Phase 4 의존성
npm install wavesurfer.js

# Phase 6 의존성 (테스트)
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test
```

---

## 3. 폴더 구조

```
video-trimmer/
├── public/
├── src/
│   ├── app/
│   │   ├── layout.tsx             # 루트 레이아웃
│   │   ├── page.tsx               # 메인 페이지
│   │   └── globals.css            # 전역 스타일
│   │
│   ├── features/
│   │   ├── upload/
│   │   │   ├── components/
│   │   │   │   ├── UploadZone.tsx        # 드래그 앤 드롭 영역
│   │   │   │   ├── UploadProgress.tsx    # 업로드 진행률
│   │   │   │   └── FileValidationError.tsx # 검증 오류 표시
│   │   │   ├── hooks/
│   │   │   │   └── useFileUpload.ts      # 파일 업로드 로직
│   │   │   └── utils/
│   │   │       └── validateFile.ts       # 파일 검증 유틸
│   │   │
│   │   ├── player/
│   │   │   ├── components/
│   │   │   │   ├── VideoPlayerView.tsx   # Video.js 래퍼 (기존 VideoPlayer.tsx에서 변경됨)
│   │   │   │   └── PlayerControls.tsx    # 커스텀 컨트롤 (선택)
│   │   │   └── hooks/
│   │   │       └── useVideoPlayer.ts     # Video.js 인스턴스 관리 (현재 미사용, Context로 대체됨)
│   │   │
│   │   ├── timeline/
│   │   │   ├── components/
│   │   │   │   ├── TimelineEditor.tsx    # 타임라인 메인
│   │   │   │   ├── TimelineBar.tsx       # 가로 막대 배경
│   │   │   │   ├── InPointHandle.tsx     # 인 포인트 핸들
│   │   │   │   ├── OutPointHandle.tsx    # 아웃 포인트 핸들
│   │   │   │   ├── Playhead.tsx          # 플레이헤드
│   │   │   │   ├── TimeInput.tsx         # 시간 입력 필드
│   │   │   │   ├── TimeDisplay.tsx       # 시간 표시
│   │   │   │   ├── WaveformBackground.tsx # 파형 배경 (Phase 4)
│   │   │   │   └── LockButton.tsx        # 잠금 버튼 (Phase 4)
│   │   │   ├── hooks/
│   │   │   │   ├── useTimelineState.ts   # 타임라인 상태 관리
│   │   │   │   ├── useDragHandle.ts      # 드래그 로직
│   │   │   │   └── useKeyboardShortcuts.ts # 단축키 (Phase 3)
│   │   │   └── utils/
│   │   │       ├── timeFormatter.ts      # 시간 포맷팅
│   │   │       └── constrainPosition.ts  # 핸들 제약 조건
│   │   │
│   │   └── export/
│   │       ├── components/
│   │       │   ├── ExportButton.tsx      # 내보내기 버튼
│   │       │   ├── ExportProgress.tsx    # 트리밍 진행률
│   │       │   ├── DownloadButton.tsx    # 다운로드 버튼
│   │       │   └── ErrorDisplay.tsx      # 에러 표시
│   │       └── utils/
│   │           ├── trimVideoMP4Box.ts    # MP4Box 트리밍 실행
│   │           └── generateFilename.ts   # 파일명 생성
│   │
│   ├── stores/
│   │   └── useStore.ts                   # 단일 Zustand 스토어
│   │
│   ├── components/
│   │   ├── Layout.tsx                    # 앱 레이아웃
│   │   ├── LoadingSpinner.tsx            # 로딩 스피너
│   │   └── ProgressBar.tsx               # 공통 프로그레스 바
│   │
│   ├── utils/
│   │   └── formatBytes.ts                # 바이트 포맷팅
│   │
│   ├── constants/
│   │   ├── fileConstraints.ts            # 파일 제약 조건
│   │   └── keyboardShortcuts.ts          # 단축키 정의
│   │
│   └── types/
│       ├── store.ts                      # 스토어 타입
│       ├── video.ts                      # 비디오 관련 타입
│       └── timeline.ts                   # 타임라인 관련 타입
│
├── __tests__/                            # Phase 6
│   ├── unit/
│   └── e2e/
│
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts                    # (Tailwind v4 사용 시 생략 가능)
├── eslint.config.mjs
├── vitest.config.ts                      # Phase 6
├── playwright.config.ts                  # Phase 6
└── package.json
```

---

## 4. 상태 관리 설계 (Zustand)

### 4.1 스토어 구조

```typescript
// src/stores/useStore.ts

import { create } from 'zustand';

// ==================== 타입 정의 ====================

type AppPhase =
  | 'idle'           // 초기 상태
  | 'uploading'      // 파일 업로드 중
  | 'editing'        // 편집 중
  | 'processing'     // 트리밍 처리 중
  | 'completed'      // 완료
  | 'error';         // 에러 발생

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

// ==================== 스토어 상태 ====================

interface StoreState {
  // 앱 단계
  phase: AppPhase;
  
  // 비디오 파일
  videoFile: VideoFile | null;
  
  // 타임라인
  timeline: TimelineState;
  
  // 처리 진행률
  processing: ProcessingState;
  
  // 플레이어 상태
  player: PlayerState;
  
  // 에러 상태
  error: ErrorState;
  
  // 내보내기 결과
  export: ExportState;
}

// ==================== 스토어 액션 ====================

interface StoreActions {
  // Phase 변경
  setPhase: (phase: AppPhase) => void;
  
  // 파일 관련
  setVideoFile: (file: VideoFile | null) => void;
  setVideoDuration: (duration: number) => void;
  
  // 타임라인 관련
  setInPoint: (time: number) => void;
  setOutPoint: (time: number) => void;
  setPlayhead: (time: number) => void;
  setInPointLocked: (locked: boolean) => void;
  setOutPointLocked: (locked: boolean) => void;
  setZoom: (zoom: number) => void;
  resetTimeline: () => void;
  
  // 진행률 관련
  setUploadProgress: (progress: number) => void;
  setTrimProgress: (progress: number) => void;
  setWaveformProgress: (progress: number) => void;
  
  // 플레이어 관련
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  
  // 에러 관련
  setError: (message: string, code?: string) => void;
  clearError: () => void;
  
  // 내보내기 관련
  setExportResult: (url: string, filename: string) => void;
  clearExportResult: () => void;

  // 전체 리셋
  reset: () => void;
}

// ==================== 초기 상태 ====================

const initialState: StoreState = {
  phase: 'idle',
  videoFile: null,
  timeline: {
    inPoint: 0,
    outPoint: 0,
    playhead: 0,
    isInPointLocked: false,
    isOutPointLocked: false,
    zoom: 1,
  },
  processing: {
    uploadProgress: 0,
    trimProgress: 0,
    waveformProgress: 0,
  },
  player: {
    isPlaying: false,
    currentTime: 0,
    volume: 1,
    isMuted: false,
  },
  error: {
    hasError: false,
    errorMessage: null,
    errorCode: null,
  },
  export: {
    outputUrl: null,
    outputFilename: null,
  },
};

// ==================== 스토어 생성 ====================

export const useStore = create<StoreState & StoreActions>()((set, get) => ({
  ...initialState,

  // Phase 변경
  setPhase: (phase) => set({ phase }),

  // 파일 관련
  setVideoFile: (videoFile) => set({ videoFile }),
  setVideoDuration: (duration) => {
    const { videoFile } = get();
    if (videoFile) {
      set({
        videoFile: { ...videoFile, duration },
        timeline: {
          ...get().timeline,
          outPoint: duration,
        },
      });
    }
  },

  // 타임라인 관련
  setInPoint: (time) => {
    const { timeline } = get();
    if (timeline.isInPointLocked) return;
    const constrainedTime = Math.max(0, Math.min(time, timeline.outPoint));
    set({
      timeline: {
        ...timeline,
        inPoint: constrainedTime,
        playhead: Math.max(constrainedTime, timeline.playhead),
      },
    });
  },

  setOutPoint: (time) => {
    const { timeline, videoFile } = get();
    if (timeline.isOutPointLocked) return;
    const maxTime = videoFile?.duration ?? 0;
    const constrainedTime = Math.max(timeline.inPoint, Math.min(time, maxTime));
    set({
      timeline: {
        ...timeline,
        outPoint: constrainedTime,
        playhead: Math.min(constrainedTime, timeline.playhead),
      },
    });
  },

  setPlayhead: (time) => {
    const { timeline } = get();
    const constrainedTime = Math.max(
      timeline.inPoint,
      Math.min(time, timeline.outPoint)
    );
    set({
      timeline: { ...timeline, playhead: constrainedTime },
    });
  },

  setInPointLocked: (locked) =>
    set((state) => ({
      timeline: { ...state.timeline, isInPointLocked: locked },
    })),

  setOutPointLocked: (locked) =>
    set((state) => ({
      timeline: { ...state.timeline, isOutPointLocked: locked },
    })),

  setZoom: (zoom) =>
    set((state) => ({
      timeline: { ...state.timeline, zoom: Math.max(0.1, Math.min(zoom, 10)) },
    })),

  resetTimeline: () => {
    const duration = get().videoFile?.duration ?? 0;
    set({
      timeline: {
        inPoint: 0,
        outPoint: duration,
        playhead: 0,
        isInPointLocked: false,
        isOutPointLocked: false,
        zoom: 1,
      },
    });
  },

  // 진행률 관련
  setUploadProgress: (progress) =>
    set((state) => ({
      processing: { ...state.processing, uploadProgress: progress },
    })),

  setTrimProgress: (progress) =>
    set((state) => ({
      processing: { ...state.processing, trimProgress: progress },
    })),

  setWaveformProgress: (progress) =>
    set((state) => ({
      processing: { ...state.processing, waveformProgress: progress },
    })),

  // 플레이어 관련
  setIsPlaying: (playing) =>
    set((state) => ({ player: { ...state.player, isPlaying: playing } })),

  setCurrentTime: (time) =>
    set((state) => ({ player: { ...state.player, currentTime: time } })),

  setVolume: (volume) =>
    set((state) => ({
      player: { ...state.player, volume: Math.max(0, Math.min(volume, 1)) },
    })),

  setIsMuted: (muted) =>
    set((state) => ({ player: { ...state.player, isMuted: muted } })),

  // 에러 관련
  setError: (message, code) =>
    set({
      error: { hasError: true, errorMessage: message, errorCode: code ?? null },
      phase: 'error',
    }),

  clearError: () =>
    set({
      error: { hasError: false, errorMessage: null, errorCode: null },
    }),

  // 내보내기 관련
  setExportResult: (url, filename) =>
    set({
      export: { outputUrl: url, outputFilename: filename },
      phase: 'completed',
    }),

  clearExportResult: () => {
    const { export: exportState } = get();
    if (exportState.outputUrl) {
      URL.revokeObjectURL(exportState.outputUrl);
    }
    set({ export: { outputUrl: null, outputFilename: null } });
  },

  // 전체 리셋
  reset: () => {
    const { videoFile, export: exportState } = get();
    if (videoFile?.url) {
      URL.revokeObjectURL(videoFile.url);
    }
    if (exportState.outputUrl) {
      URL.revokeObjectURL(exportState.outputUrl);
    }
    set(initialState);
  },
}));
```

---

## 5~13. (중략 - 기존 내용 유지)

_컴포넌트 설계, 커스텀 훅, 유틸리티 함수, 상수 정의, 타입 정의, 설정 파일, Phase별 태스크, 에러 처리, 자가 진단 체크리스트 내용은 기존과 동일_

---

## 14. Git 커밋 컨벤션

> **공식 가이드**: [Udacity Git Commit Message Style Guide](https://udacity.github.io/git-styleguide/)

### 14.1 커밋 메시지 기본 형식

```
<type>: <subject>

<body> (선택)
```

### 14.2 Type 분류

| Type | 설명 | 사용 시점 |
|------|------|-----------|
| `feat` | 새로운 기능 추가 | 컴포넌트, 훅, 유틸 함수 등 신규 기능 구현 |
| `fix` | 버그 수정 | 기능 오류, 로직 버그, 타입 에러 수정 |
| `design` | UI/UX 디자인 변경 | CSS, Tailwind 클래스, 레이아웃 조정 |
| `refactor` | 코드 리팩토링 | 기능 변경 없이 코드 구조 개선 |
| `docs` | 문서 수정 | README, 주석, 설계서 등 문서 작업 |
| `test` | 테스트 코드 추가/수정 | Vitest, Playwright 테스트 작성 |
| `chore` | 기타 변경사항 | 빌드 설정, 패키지 설치, 설정 파일 수정 |

### 14.3 Subject 작성 규칙

1. **50자 이하**로 간결하게 작성
2. **대문자로 시작**, 마침표 없음
3. **명령형 동사** 사용 (Add, Fix, Update, Remove, Refactor)
4. **구체적으로** 무엇을 변경했는지 명시

```bash
# ✅ 좋은 예
feat: Add UploadZone component with drag-and-drop
fix: Prevent outPoint from exceeding video duration
design: Update timeline handle hover effect
refactor: Extract time formatting logic to utility

# ❌ 나쁜 예
feat: added upload zone  # 소문자, 과거형
fix: bug fix.  # 불명확, 마침표
feat: 업로드 존 추가  # 한글 (영문 권장)
chore: update files  # 너무 추상적
```

### 14.4 Body 작성 가이드 (선택사항)

- **What & Why**를 설명 (How는 코드가 설명)
- 72자 이내로 줄바꿈
- Subject와 한 줄 띄우기
- body 내용에 ai가 작성했다는 내용을 제외하라.

```bash
feat: Add file size validation in UploadZone

Add validation to reject files larger than 1GB before upload.
This prevents unnecessary memory usage and provides immediate
feedback instead of failing during FFmpeg processing.
```

### 14.5 상황별 커밋 예시

#### 기능 구현 (feat)

```bash
# 새로운 컴포넌트
feat: Add VideoPlayer component with Video.js integration
feat: Add TimelineEditor with drag handles

# 새로운 훅
feat: Add useFFmpeg hook for FFmpeg instance management
feat: Add useDragHandle hook for timeline interactions

# 새로운 유틸 함수
feat: Add time formatting utilities (formatTime, parseTime)
feat: Add file validation utility with size/type checks
```

#### 버그 수정 (fix)

```bash
# 로직 오류
fix: Prevent playhead from exceeding outPoint
fix: Resolve timeline drag constraint calculation error

# UI 버그
fix: Correct timeline handle positioning on window resize
fix: Fix progress bar overflow on mobile screens

# 타입 에러
fix: Add missing null check in useVideoPlayer hook
fix: Resolve TypeScript error in FFmpeg progress handler
```

#### UI/디자인 변경 (design)

```bash
# 스타일 조정
design: Update timeline handle colors for better visibility
design: Improve upload zone hover state animation

# 레이아웃 변경
design: Adjust player aspect ratio to 16:9
design: Refine spacing between timeline components
```

#### 리팩토링 (refactor)

```bash
# 코드 구조 개선
refactor: Extract FFmpeg loading logic to separate utility
refactor: Split TimelineEditor into smaller sub-components

# 성능 최적화
refactor: Memoize expensive calculations in timeline rendering
refactor: Optimize re-renders using React.memo
```

#### 기타 작업 (docs, test, chore)

```bash
# 문서
docs: Add setup instructions to README
docs: Update API documentation for trimVideo function

# 테스트
test: Add unit tests for time formatting utilities
test: Add E2E test for upload-to-download flow

# 설정/의존성
chore: Add @ffmpeg/ffmpeg dependency
chore: Configure COOP/COEP headers in next.config.ts
```

### 14.6 커밋 타이밍 원칙

#### 언제 커밋할까?

```
✅ 커밋하기 좋은 시점:
- 하나의 완결된 기능 구현 완료
- 버그 하나 수정 완료
- 리팩토링 한 단위 완료
- 타입 에러 0개 + 린트 에러 0개 상태

❌ 너무 이른 커밋:
- 코드가 동작하지 않는 상태
- 타입 에러가 있는 상태
- 여러 기능이 섞여 있는 상태

❌ 너무 늦은 커밋:
- 여러 기능을 한 번에 구현 후
- 하루 작업을 한 번에 커밋
```

#### 커밋 전 체크리스트

```bash
# 1. 타입 에러 확인
npx tsc --noEmit

# 2. 린트 에러 확인
npm run lint

# 3. 변경사항 리뷰
git diff --staged

# 4. 커밋
git commit -m "feat: Add specific feature"
```

#### 세분화 커밋 전략

**의미 있는 작은 단위로 자주 커밋**

```bash
# ❌ 나쁜 예: 큰 단위 커밋
git add src/features/timeline/
git commit -m "feat: Add timeline feature"

# ✅ 좋은 예: 세분화 커밋
git add src/features/timeline/utils/timeFormatter.ts
git commit -m "feat: Add time formatting utilities"

git add src/features/timeline/components/TimelineBar.tsx
git commit -m "feat: Add TimelineBar base component"

git add src/features/timeline/components/InPointHandle.tsx
git commit -m "feat: Add InPointHandle with drag support"
```

### 14.7 유용한 Git 명령어

```bash
# 파일 일부만 스테이징 (대화형)
git add -p <파일명>

# 스테이징 취소
git reset HEAD <파일명>

# 마지막 커밋 메시지 수정
git commit --amend -m "새로운 메시지"

# 마지막 커밋에 파일 추가 (메시지 유지)
git add <파일명>
git commit --amend --no-edit

# 커밋 히스토리 보기
git log --oneline --graph -10
```

---

## 15. 참고 자료

### 15.1 공식 문서
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [MP4Box.js (GPAC)](https://github.com/gpac/mp4box.js)
- [Video.js Documentation](https://videojs.com/guides)
- [wavesurfer.js Documentation](https://wavesurfer.xyz)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### 15.2 핵심 API 참조
- MP4Box.js: `MP4Box.createFile()`, `appendBuffer()`, `setExtractionOptions()`, `save()`
- Video.js: `videojs(id, options)`, `player.currentTime()`, `player.duration()`
- wavesurfer.js: `WaveSurfer.create({ container, waveColor, progressColor, url })`
- Zustand: `create<State>()((set, get) => ({ ... }))`

---

**설계서 작성 완료**

> 이 설계서를 기반으로 Phase 1부터 순차적으로 구현을 진행하면 됩니다.
> 각 Phase 완료 시 자가 진단 체크리스트를 통해 품질을 확인하세요.
