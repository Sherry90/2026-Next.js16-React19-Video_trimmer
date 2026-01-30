# Video Trimmer - Initial Project Specification

> **Historical Document** - This represents the initial design and planning phase
>
> **Created**: 2026-01-20
> **Phase Coverage**: Planning & Phase 1-6 Design
> **Status**: ✅ All phases completed (as of 2026-01-30)
>
> **Note**: This document reflects the original design intent. See `.docs/02-history/DEVELOPMENT-HISTORY.md` for implementation changes and improvements made during development.

---

## 1. Project Overview

### 1.1 Purpose
Browser-based web application for video trimming without server uploads. All processing happens client-side.

### 1.2 Core Principles
- **No server dependency**: All processing performed on client-side
- **Personal project**: Non-commercial, learning-focused
- **Progressive development**: Implemented in 6 phases

### 1.3 Project Nature
- Personal learning project
- No commercial use
- Focus on modern web technologies

---

## 2. Technology Stack (Initial Design)

| Technology | Version | Package Name | Role |
|------------|---------|--------------|------|
| Next.js | 16.1.1 | `next@16.1.1` | Framework |
| React | 19.x | `react@latest` | UI Library |
| TypeScript | 5.x | `typescript@latest` | Type Safety |
| Turbopack | Built-in | - | Bundler (Next.js 16 default) |
| React Compiler | Built-in | `babel-plugin-react-compiler` | Auto-memoization |
| **FFmpeg.wasm** | - | `@ffmpeg/ffmpeg` | **Video trimming (initial plan)** ⚠️ |
| Video.js | 8.x | `video.js` | Video playback |
| wavesurfer.js | 7.x | `wavesurfer.js` | Audio waveform (Phase 4) |
| Zustand | 5.x | `zustand` | State management |
| Tailwind CSS | 4.x | `tailwindcss` | Styling |
| Vitest | 3.x | `vitest` | Unit testing (Phase 6) |
| Playwright | 1.x | `@playwright/test` | E2E testing (Phase 6) |

> ⚠️ **Important Change**: FFmpeg.wasm was replaced with MP4Box.js during Phase 6 for better performance and stream-copy capabilities. See `.docs/02-history/DEVELOPMENT-HISTORY.md` for details.

### 2.1 Installation Commands

```bash
# Project creation
npx create-next-app@16.1.1 video-trimmer --typescript --tailwind --eslint --app --turbopack

# Core dependencies
npm install zustand video.js @ffmpeg/ffmpeg  # Note: FFmpeg later replaced

# React Compiler
npm install -D babel-plugin-react-compiler

# Phase 4 dependencies
npm install wavesurfer.js

# Phase 6 dependencies (Testing)
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm install -D @playwright/test
```

---

## 3. Technical Requirements

### 3.1 Video Processing (Original Plan)
- **Method**: FFmpeg.wasm transcoding
- **Accuracy**: Frame-accurate trimming
- **Constraints**: Slower processing, larger bundle size
- **COOP/COEP**: Required for SharedArrayBuffer support

> **Actual Implementation**: Switched to MP4Box.js stream-copy for speed, with FFmpeg.wasm as fallback

### 3.2 Input Specifications
- **Formats**: MP4, WebM, OGG, QuickTime, AVI, MKV
- **Size Limit**: 1GB (configurable)
- **Validation**: Reject invalid files with warning message

### 3.3 Output Specifications
- Preserve original metadata (quality, resolution, codec)
- Filename format: `{original}_edited.{ext}`

### 3.4 Browser Compatibility
- Modern browsers (Chrome, Edge, Firefox, Safari)
- File API and Blob support required
- SharedArrayBuffer support (for FFmpeg.wasm)

---

## 4. Terminology

| Term (Korean) | English | Description |
|---------------|---------|-------------|
| 트리밍 | Trimming | Video cutting operation |
| 인 포인트 | In Point | Trim start position |
| 아웃 포인트 | Out Point | Trim end position |
| 플레이헤드 | Playhead | Current playback position |
| 타임라인 에디터 | Timeline Editor | Trim control UI component |

---

## 5. Application Flow

```
[Upload Screen]
     ↓ File select/drag
[Uploading] ← File upload progress + FFmpeg loading
     ↓ Complete
[Editing Screen] ← Video player + Timeline editor
     ↓ Export button
[Processing] ← Trimming progress (0~100%)
     ↓
[Completed] → Download button
[Error] → Error message display
```

**Phase 5 Addition**:
- After completion/error → Edit new file, Retry

---

## 6. Component Architecture

### 6.1 Main Components (Separate Files)

| Component | Role |
|-----------|------|
| Layout | App-wide layout |
| Upload | File upload (drag & drop), progress display |
| Video Player | Video.js-based playback |
| Timeline Editor | Trim control UI |
| Download | Download button for completed video |
| Loading | Processing progress display |
| Error | Error message display (for development) |

### 6.2 Screen Transitions

1. **Initial**: Upload component only
2. **Upload Started**: Progress display (file + FFmpeg)
3. **Complete**: Timeline editor + video player
4. **Export Clicked**: Trimming progress
5. **Processing Complete**: Download button
6. **Processing Failed**: Error screen

---

## 7. Timeline Editor Design

### 7.1 UI Structure
- **Form**: Horizontal bar
- **Background**:
  - Phase 2~3: Solid color
  - Phase 4: Audio waveform (wavesurfer.js), empty if no audio
- **Edges**: Start time (0) ~ End time (video duration)

### 7.2 Handles (3 types, visually distinct)

| Handle | Initial Position | Manipulation |
|--------|------------------|--------------|
| In Point | 0s (video start) | Drag or time input |
| Out Point | Video end | Drag or time input |
| Playhead | In Point position | Click or drag |

### 7.3 Handle Constraints
- In Point cannot exceed Out Point
- Out Point cannot go before In Point
- Playhead moves only between In Point and Out Point

### 7.4 Lock Feature (Phase 4)
- Lock icon UI next to In/Out Point time inputs
- When locked, handle cannot be moved

### 7.5 Playback Behavior
- **Play start**: From playhead position → to Out Point
- **After playback ends**: Next play starts from playhead position
- **Playhead moved during play**: Resume playback from new position

### 7.6 Preview Options

**(A) Full Segment** (Phase 3):
- Play In Point → Out Point

**(B) Preview Edges** (Phase 4):
- Play: (In Point → In Point +5s) + (Out Point -5s → Out Point)
- If segment < 10s: Play full segment (same as A)

### 7.7 Zoom Feature (Phase 4)
- **Control**: Ctrl + Mouse Wheel
- **Range**: 0.1x ~ 10x

### 7.8 Keyboard Shortcuts

| Key | Function | Phase |
|-----|----------|-------|
| Space | Play/Pause | 2 |
| ← / → | Frame-by-frame navigation | 3 |
| Shift + ← / → | 1-second navigation | 3 |
| I | Set In Point at playhead | 3 |
| O | Set Out Point at playhead | 3 |
| Home | Jump to In Point | 3 |
| End | Jump to Out Point | 3 |

---

## 8. Progress UI Summary

| Stage | Progress Display | Phase |
|-------|------------------|-------|
| FFmpeg.wasm download | ✅ (simultaneous with upload) | 2 |
| File upload | ✅ | 2 |
| Waveform generation | ✅ | 4 |
| Trimming processing | ✅ | 2 |

---

## 9. Error Handling (Development Stage)

- Display raw error messages
- Show detailed information for developer debugging
- No user-friendly error messages initially

---

## 10. Folder Structure (Feature-Based)

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page
│   └── globals.css         # Global styles
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
│           ├── trimVideoFFmpeg.ts      # Original plan
│           └── generateFilename.ts
│
├── stores/
│   └── useStore.ts         # Single Zustand store
│
├── components/             # Shared components
│   ├── Layout.tsx
│   ├── LoadingSpinner.tsx
│   └── ProgressBar.tsx
│
├── hooks/                  # Shared hooks
├── utils/                  # Shared utilities
│   └── formatBytes.ts
│
├── constants/              # Constants
│   ├── fileConstraints.ts
│   └── keyboardShortcuts.ts
│
└── types/                  # Type definitions
    ├── store.ts
    ├── video.ts
    └── timeline.ts
```

---

## 11. Design Principles

- **Single Responsibility**: One function, one responsibility
- **Granular Separation**: Components, utilities, and constants maximally separated
- **High Cohesion**: Group related functionality
- **Avoid Extreme Separation**: Separate by role/function, not arbitrarily

---

## 12. Development Phases

### Phase 1: Project Setup & Basic Bootstrap ✅ COMPLETE (2026-01-20)
- [x] Next.js 16 + Turbopack + TypeScript initialization
- [x] Tailwind CSS configuration
- [x] COOP/COEP headers setup (for FFmpeg.wasm SharedArrayBuffer)
- [x] Zustand store structure
- [x] ESLint, Prettier configuration
- [x] Feature-based folder structure
- [x] Basic layout component
- [x] Dev server running verification
- [x] `tsc --noEmit` passing

### Phase 2: Core Flow + Basic UI ✅ COMPLETE (2026-01-21)
- [x] File upload component (drag & drop) + Progress
- [x] Input validation (format, 1GB limit) + Warning on rejection
- [x] FFmpeg.wasm loading + Progress + Caching
- [x] Video.js player component
- [x] Timeline editor (solid background)
  - [x] In Point / Out Point handles (draggable)
  - [x] In Point / Out Point time inputs
  - [x] Playhead + current time display
  - [x] Handle constraints (In < Out)
  - [x] Visually distinct handles
- [x] Playback (Space key)
- [x] Trim execution + Progress
- [x] Download (`_edited` suffix)
- [x] Error display (raw messages)
- [x] **Bug Fix**: Playhead snap-back removed (commit 23fa7f9)

### Phase 3: Convenience Features ✅ COMPLETE (2026-01-21)
- [x] Keyboard shortcuts (←→, Shift+←→, I, O, Home, End)
- [x] Preview (A) Full segment

### Phase 4: Advanced Features ✅ COMPLETE (2026-01-28)
- [x] wavesurfer.js waveform + Progress (empty if no audio)
- [x] Timeline zoom (Ctrl + Wheel)
- [x] In/Out Point lock feature
- [x] Preview (B) Edge preview option (improved)

### Phase 5: Flow Completion ✅ COMPLETE (2026-01-27)
- [x] Edit new file after completion ("Edit Another File" button in DownloadButton)
- [x] Retry after failure ("Start Over" button in ErrorDisplay)

### Phase 6: Testing ✅ COMPLETE (2026-01-28)
- [x] Vitest unit tests
  - [x] Utility functions (timeFormatter, constrainPosition, validateFile)
  - [x] Zustand store (all state management logic)
  - [x] Core logic (91 tests passing)
- [x] Playwright E2E test setup
  - [x] Test framework configuration
  - [x] Upload workflow test skeleton
  - [x] Editor interaction test skeleton
  - [x] Full workflow test skeleton
  - ⚠️ Tests requiring real video files are skipped

> **Note**: During Phase 6, MP4Box.js was introduced as the primary trimming method, with FFmpeg.wasm kept as a fallback. See implementation history for details.

---

## 13. State Management Design (Zustand)

### 13.1 Store Structure

```typescript
type AppPhase =
  | 'idle'           // Initial state
  | 'uploading'      // File uploading
  | 'editing'        // Editing
  | 'processing'     // Trimming in progress
  | 'completed'      // Complete
  | 'error';         // Error occurred

interface VideoFile {
  file: File;
  name: string;
  size: number;
  type: string;
  url: string;           // Object URL
  duration: number;      // in seconds
}

interface TimelineState {
  inPoint: number;       // in seconds
  outPoint: number;      // in seconds
  playhead: number;      // in seconds
  isInPointLocked: boolean;   // Phase 4
  isOutPointLocked: boolean;  // Phase 4
  zoom: number;          // Phase 4 (1 = 100%)
}

interface ProcessingState {
  uploadProgress: number;     // 0-100
  ffmpegLoadProgress: number; // 0-100 (original plan)
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

### 13.2 Store Actions
- Phase management: `setPhase`
- File operations: `setVideoFile`, `setVideoDuration`
- Timeline operations: `setInPoint`, `setOutPoint`, `setPlayhead`, locks, zoom
- Progress updates: `setUploadProgress`, `setTrimProgress`, `setWaveformProgress`
- Player controls: `setIsPlaying`, `setCurrentTime`, `setVolume`, `setIsMuted`
- Error handling: `setError`, `clearError`
- Export results: `setExportResult`, `clearExportResult`
- Reset: `reset` (with URL.revokeObjectURL cleanup)

---

## 14. Git Commit Convention

> **Official Guide**: [Udacity Git Commit Message Style Guide](https://udacity.github.io/git-styleguide/)

### 14.1 Commit Message Format

```
<type>: <subject>

<body> (optional)
```

### 14.2 Type Categories

| Type | Description | Use Case |
|------|-------------|----------|
| `feat` | New feature | New component, hook, utility function |
| `fix` | Bug fix | Function errors, logic bugs, type errors |
| `design` | UI/UX design changes | CSS, Tailwind classes, layout adjustments |
| `refactor` | Code refactoring | Code structure improvement without behavior change |
| `docs` | Documentation updates | README, comments, design docs |
| `test` | Test code additions/updates | Vitest, Playwright tests |
| `chore` | Other changes | Build config, package install, config files |

### 14.3 Subject Writing Rules

1. **50 characters or less**, concise
2. **Start with capital letter**, no period
3. Use **imperative verbs** (Add, Fix, Update, Remove, Refactor)
4. **Be specific** about what changed

```bash
# ✅ Good examples
feat: Add UploadZone component with drag-and-drop
fix: Prevent outPoint from exceeding video duration
design: Update timeline handle hover effect
refactor: Extract time formatting logic to utility

# ❌ Bad examples
feat: added upload zone  # lowercase, past tense
fix: bug fix.  # unclear, has period
feat: 업로드 존 추가  # Korean (English preferred)
chore: update files  # too abstract
```

### 14.4 Commit Timing Principles

**✅ Good timing for commits:**
- One complete feature implemented
- One bug fixed
- One refactoring unit completed
- Type errors = 0 + Lint errors = 0

**❌ Too early:**
- Code doesn't work
- Type errors present
- Multiple features mixed

**❌ Too late:**
- Multiple features at once
- Day's work in one commit

---

## 15. Development Checklist (Required)

After each Phase completion:

1. **Function Test**: Verify Phase features work correctly
2. **Type Check**: Run `tsc --noEmit`, ensure no type errors
3. **Lint Check**: Ensure no ESLint errors
4. **Git Commit**: Commit working code with proper convention

---

## 16. Reference Documentation

### 16.1 Official Docs
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [FFmpeg.wasm Documentation](https://ffmpegwasm.netlify.app) ⚠️ (later replaced with MP4Box.js)
- [Video.js Documentation](https://videojs.com/guides)
- [wavesurfer.js Documentation](https://wavesurfer.xyz)
- [Zustand Documentation](https://docs.pmnd.rs/zustand)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### 16.2 Key API References
- FFmpeg.wasm: `load()`, `writeFile()`, `exec()`, `readFile()` ⚠️ (original plan)
- Video.js: `videojs(id, options)`, `player.currentTime()`, `player.duration()`
- wavesurfer.js: `WaveSurfer.create({ container, waveColor, progressColor, url })`
- Zustand: `create<State>()((set, get) => ({ ... }))`

---

## 17. Implementation Notes

### 17.1 What Changed During Development

This specification represents the **initial design intent** as of 2026-01-20. Several important changes occurred during implementation:

1. **MP4Box.js Migration** (2026-01-28): Replaced FFmpeg.wasm as primary trimming method for performance reasons
2. **Hybrid Approach** (2026-01-29): FFmpeg.wasm retained as fallback for accuracy-critical scenarios
3. **Major Refactoring** (2026-01-30): 6-phase refactoring reduced codebase by 787 lines (15.6%)

See `.docs/02-history/DEVELOPMENT-HISTORY.md` for detailed evolution of the project.

### 17.2 Why This Document Matters

This initial specification is preserved to:
- **Document design decisions**: Why certain technologies were chosen
- **Track evolution**: Compare original plan vs. actual implementation
- **Educational value**: Learn from design changes and trade-offs
- **Context for new contributors**: Understand project origins

---

**Specification Version**: 1.0 (Initial Design)
**Status**: Historical Reference
**All Phases**: ✅ Completed (as of 2026-01-30)

> This document should be referenced alongside current documentation in `.docs/03-current/` for a complete understanding of the project.
