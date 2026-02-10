# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A client-side web application for trimming videos in the browser without server uploads. Built with Next.js 16 and uses MP4Box.js for stream-copy trimming (no re-encoding).

## Commands

### Development
```bash
npm run dev           # Start dev server on localhost:3000 (Turbopack)
npm run build         # Production build
npm start             # Start production server
npm run lint          # Run ESLint
npm run type-check    # TypeScript type checking (tsc --noEmit)
```

### Testing
```bash
npm test              # Run Vitest unit tests
npm run test:ui       # Vitest UI
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E tests (most skipped - need real video files)
npm run test:e2e:ui   # Playwright UI
```

**Note**: E2E tests require actual video files and are mostly skipped. Unit tests cover core logic comprehensively.

## Architecture

### State Management (Zustand)

Single store at `src/stores/useStore.ts` manages all application state:

**Phase-based workflow**: The application progresses through phases:
- `idle` → `uploading` → `editing` → `processing` → `completed` | `error`

**State structure**:
- `timeline`: currentTime, duration, inPoint, outPoint, zoom, locks
- `processing`: phase, progress, videoUrl, processedVideoUrl
- `player`: isPlaying, isScrubbing, isSeeking
- `error`: errorMessage, errorCode
- `export`: trimmedUrl, filename

**Critical patterns**:
- State setters include validation (e.g., `setInPoint` constrains between 0 and outPoint)
- Memory management: `URL.revokeObjectURL()` called on cleanup to prevent leaks
- Immutable updates using spread operators
- **Selector pattern** (`src/stores/selectors.ts`): Reusable selectors with `useShallow` for optimized re-renders
  - `useTimelineState()`, `useTimelineActions()`, `usePlayerState()`, etc.

### Feature-Based Organization

```
src/features/
├── upload/        # File upload, drag-and-drop, validation
├── player/        # Video.js player, context provider, playback controls
├── timeline/      # Timeline editor (refactored into focused components)
│   ├── components/
│   │   ├── TimelineEditor.tsx      # 64 lines (orchestrator)
│   │   ├── TrimHandle.tsx          # Unified In/Out handle
│   │   ├── Playhead.tsx            # Memoized
│   │   ├── TimelineControls.tsx    # Control grouping
│   │   ├── PreviewButtons.tsx      # Preview UI
│   │   └── WaveformBackground.tsx
│   └── hooks/
│       ├── usePreviewPlayback.ts   # Preview logic
│       └── useTimelineZoom.ts      # Zoom logic
└── export/        # Export button, trimming logic (MP4Box/FFmpeg)
```

Each feature has `components/`, `hooks/`, `utils/`, and sometimes `context/`.

**Recent refactoring (2026-01-30)**: TimelineEditor decomposed from 182 lines to 64 lines. InPointHandle/OutPointHandle merged into TrimHandle.

### Video Processing Flow

1. **Upload** (`idle` → `uploading` → `editing`):
   - User drops/selects file in `UploadZone`
   - `useFileUpload.handleFileSelect()` validates format and size
   - Creates Object URL, sets phase to 'editing'

2. **Editing** (`editing`):
   - `VideoPlayerView` initializes video.js player
   - `WaveformBackground` loads audio visualization (wavesurfer.js)
   - `TimelineEditor` provides trim controls (handles, inputs, keyboard shortcuts)

3. **Export** (`editing` → `processing` → `completed`):
   - User clicks Export button
   - **Primary**: MP4Box.js stream copy (src/features/export/utils/trimVideoMP4Box.ts)
   - **Fallback**: FFmpeg.wasm transcoding (src/features/export/utils/trimVideoFFmpeg.ts)
   - MP4Box finds nearest keyframe, extracts samples in time range, creates new MP4
   - Sets phase to 'completed' with download URL

4. **Download/Reset**:
   - Download button with proper filename (`{original}_edited.{ext}`)
   - Reset to edit new file (proper cleanup of Object URLs)

### Player-Timeline Synchronization

**Critical pattern to prevent race conditions**:

The timeline uses a scrubbing state to avoid conflicts between user interaction and video playback:

```typescript
// VideoPlayerView.tsx - timeupdate handler
player.on('timeupdate', () => {
  const state = useStore.getState();

  // CRITICAL: Ignore if scrubbing or seeking
  if (state.player.isScrubbing || player.seeking()) {
    return; // Prevents overwriting store during user interaction
  }

  state.setCurrentTime(currentTime || 0);
});
```

**Playhead dragging** (`src/features/timeline/components/Playhead.tsx`):
- Sets `isScrubbing: true` on mousedown
- Works in PERCENTAGE coordinates during drag
- Converts to time only at drag end
- Uses refs for stable closures to prevent stale state

**Video player context** (`src/features/player/context/VideoPlayerContext.tsx`):
- Provides video.js player instance to child components
- Exposes control methods: `play()`, `pause()`, `seek()`, `togglePlay()`
- Prevents prop drilling

### MP4Box.js vs FFmpeg.wasm

**Current approach**: MP4Box.js (primary implementation)
- Stream copy without re-encoding
- Fast, maintains quality, lightweight bundle
- Keyframe-based trimming (1-2 second accuracy, not frame-accurate)
- Implementation: Parses MP4 structure, filters samples by time range, creates new MP4

**Fallback**: FFmpeg.wasm (still in codebase at `src/features/export/utils/trimVideoFFmpeg.ts`)
- Would provide frame-accurate trimming
- Slower, larger bundle, requires SharedArrayBuffer
- Not actively used but available if needed

### Dependency Bundling

All required binaries are automatically managed:

**ffmpeg**: Bundled via `@ffmpeg-installer/ffmpeg` (v4.4)
- Installed as npm dependency
- System ffmpeg as fallback

**yt-dlp**: Auto-downloaded on postinstall
- Priority: system > `.bin/yt-dlp` (auto-downloaded) > yt-dlp-wrap
- Downloaded from GitHub releases by `scripts/setup-deps.mjs`

**streamlink**: Auto-downloaded on postinstall
- Priority: bundled binary > system binary
- Windows: portable .exe from streamlink/windows-builds
- Linux: AppImage from streamlink/streamlink-appimage (x64/ARM64)
- macOS: system only (install via `brew install streamlink`)
- Downloaded to `.bin/` folder (Git-ignored)
- `scripts/setup-deps.mjs` runs on postinstall to check/download dependencies

**Binary path resolution**: `src/lib/binPaths.ts`
- `getFfmpegPath()`: Returns bundled or system ffmpeg
- `getYtdlpPath()`: Returns system, `.bin/`, or yt-dlp-wrap path
- `getStreamlinkPath()`: Returns bundled or system streamlink
- `hasStreamlink()`: Checks if streamlink is available
- `checkDependencies()`: Returns availability status of all tools

**Build configuration**: `next.config.ts`
- `serverExternalPackages: ['@ffmpeg-installer/ffmpeg', 'yt-dlp-wrap']` required for Turbopack

## Important Implementation Details

### 1. Scrubbing State Management
File: `src/features/timeline/components/Playhead.tsx`

Uses `isScrubbing` flag to prevent race conditions:
- During drag, playhead works in percentage coordinates
- Video timeupdate events are ignored when scrubbing
- Only converts to time and seeks on drag end
- Uses `seeked` event verification to handle correct seek completion

### 2. Keyboard Shortcuts
File: `src/features/timeline/hooks/useKeyboardShortcuts.ts`

Protected from input interference:
```typescript
if (
  target.tagName === 'INPUT' ||
  target.tagName === 'TEXTAREA' ||
  target.isContentEditable
) {
  return; // Don't intercept when typing in inputs
}
```

Active only during 'editing' phase.

### 3. Preview Edges Feature
File: `src/features/timeline/components/PreviewButtons.tsx`

Intelligent preview logic:
- Short segments (<10s): plays full segment
- Long segments: plays first 5s, jumps to last 5s
- Uses video.js `seeked` event to resume playback after jump

### 4. Waveform Visualization
File: `src/features/timeline/components/WaveformBackground.tsx`

- Loads audio from video URL using wavesurfer.js
- Displays loading progress
- Gracefully handles videos without audio track
- Supports zoom (linked to timeline zoom state)
- Destroyed and recreated when video changes

### 5. Timeline Zoom
Files: `src/stores/useStore.ts`, `src/features/timeline/components/WaveformBackground.tsx`

- Ctrl+wheel to zoom (0.1 - 10x)
- Zoom factor stored in Zustand
- Applied to wavesurfer: `wavesurfer.zoom(zoom * 10)`
- Timeline handles scale proportionally

### 6. Memory Management

Proper cleanup throughout:
- Object URLs revoked in store reset (`URL.revokeObjectURL()`)
- Video.js player disposed on component unmount
- Wavesurfer destroyed when video changes
- Event listeners removed in useEffect cleanup functions

## Code Patterns

### Custom Hooks
- `useDragHandle`: Reusable dragging logic with mouse events
- `useFileUpload`: File upload with validation
- `useKeyboardShortcuts`: Global keyboard shortcuts with phase awareness
- `usePreviewPlayback`: Preview playback logic (full segment, edges)
- `useTimelineZoom`: Timeline zoom control (Ctrl+wheel)

### Context Usage
Only the video player uses React Context to avoid prop drilling of the video.js instance. All other state uses Zustand.

### Type Safety
- Separate type files: `store.ts`, `video.ts`, `timeline.ts`
- Discriminated union for AppPhase
- Custom interfaces for MP4Box (missing official types)

## Development Constraints

### Supported Formats
MP4, WebM, OGG, QuickTime (.mov), AVI, MKV

### Validation
- Max file size: 1GB (configurable in `src/constants/file.ts`)
- Format validation in `src/features/upload/utils/validateFile.ts`

### Keyframe Accuracy
MP4Box trimming finds the nearest keyframe to start time, resulting in 1-2 second accuracy (not frame-accurate). This is a trade-off for fast, no-encoding trimming.

## Testing Strategy

### Unit Tests (Vitest)
Comprehensive coverage of:
- Utility functions (timeFormatter, constrainPosition, validateFile)
- Zustand store logic (all state management)
- 92 tests passing (updated after refactoring)

### E2E Tests (Playwright)
Framework configured with test skeletons:
- Upload workflow
- Editor interactions
- Full trimming workflow
- Most tests skipped (require real video files)

## Common Development Patterns

When adding features:
1. Add state to Zustand store with validation
2. Create feature folder with components/hooks/utils
3. Use context only if needed to avoid prop drilling
4. Add unit tests for logic, E2E tests for workflows
5. Run `npm run type-check` before committing

When debugging timeline sync issues:
- Check `isScrubbing` and `isSeeking` flags
- Verify timeupdate handlers ignore events during user interaction
- Use refs for stable closures in event handlers

When working with video.js:
- Access player via `useVideoPlayerContext()`
- Always check player exists before calling methods
- Dispose player on component unmount

## Git Commit Guidelines

### Commit Process

**ALWAYS use interactive staging**:
```bash
git add -p  # or git add --patch
```

### Commit Message Format

**Language**: Write commit messages in Korean (한국어)

**DO NOT include**:
- AI authorship mentions
- Co-Authored-By lines
- References to Claude or AI assistance

**Format**:
```
<type>: <subject in Korean>

<body in Korean - optional>
```

**Types**:
- `feat`: 새 기능
- `fix`: 버그 수정
- `refactor`: 리팩토링
- `docs`: 문서 변경
- `test`: 테스트 추가/수정
- `chore`: 기타 변경

**Example**:
```
feat: 타임라인 줌 기능 추가

Ctrl+휠로 타임라인 줌 조절 가능
- 줌 범위: 0.1x ~ 10x
- Waveform과 연동
```

## Documentation

Comprehensive project documentation is organized in `.docs/`:

- **`.docs/PROJECT.md`** - Complete project documentation (start here)
  - Overview, current state, architecture, development workflow
  - Technical stack, video processing, performance characteristics
  - Deployment, constraints, limitations
- **`.docs/HISTORY.md`** - Complete development history (2026-01-21 ~ 2026-02-11)
  - Timeline, major milestones, bug fixes, refactoring
  - URL trimming implementation, Streamlink auto-download
  - Technical lessons learned
- **`.docs/archive/`** - Historical documents for reference

For current project status and architecture, refer to PROJECT.md. For development history and architectural decisions, refer to HISTORY.md.
