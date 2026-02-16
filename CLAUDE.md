# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A client-side web application for trimming videos in the browser without server uploads. Built with Next.js 16, uses MP4Box.js for fast stream-copy trimming, and supports both local files and URL sources (YouTube, Chzzk).

## Commands

### Development
```bash
npm run dev           # Start dev server (localhost:3000, Turbopack)
npm run build         # Production build
npm start             # Start production server
npm run lint          # Run ESLint
npm run type-check    # TypeScript type checking
```

### Testing
```bash
npm test              # Run Vitest unit tests
npm run test:ui       # Vitest UI
npm run test:coverage # Coverage report
npm run test:e2e      # Playwright E2E tests (most skipped)
npm run test:e2e:ui   # Playwright UI
```

## Quick Reference

### 키보드 단축키 (편집 화면)

| 키 | 기능 |
|----|------|
| **Space** | 재생/일시정지 |
| **I** / **O** | In Point / Out Point 설정 |
| **←** / **→** | 1초 이동 |
| **Shift + ←/→** | 0.1초 이동 (프레임) |
| **Home** / **End** | In Point / Out Point로 점프 |
| **Ctrl + 휠** | 타임라인 줌 (0.1x ~ 10x) |

단축키는 입력 필드 포커스 시 비활성화됩니다.

### 핵심 아키텍처

- **State**: Zustand 단일 스토어 (`src/stores/useStore.ts`), Selector 패턴
- **Phase**: idle → uploading → editing → processing → completed | error
- **Features**: `src/features/` 하위에 upload, url-input, player, timeline, export
- **Processing**: MP4Box.js (primary) / FFmpeg.wasm (fallback)
- **Dependencies**: ffmpeg, yt-dlp, streamlink (자동 다운로드)

### Feature 구조

```
src/features/<feature>/
├── components/    # React 컴포넌트
├── hooks/         # Custom hooks
├── utils/         # 유틸리티 함수
└── context/       # Context Provider (필요시)
```

## Critical Patterns

### 1. Player-Timeline Synchronization

**Race condition 방지**:
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

**Playhead dragging** (`Playhead.tsx`):
- `isScrubbing: true` on mousedown
- Works in PERCENTAGE coordinates during drag
- Converts to time only at drag end
- Uses refs for stable closures

### 2. Phase-based Workflow

상태는 항상 순차적으로 진행:
- `idle` → `uploading` → `editing` → `processing` → `completed` | `error`
- Phase 변경 시 이전 phase 상태 정리 필요 (URL revoke 등)

### 3. Memory Management

**필수 cleanup**:
- Object URLs: `URL.revokeObjectURL()` on reset/unmount
- Video.js player: `player.dispose()` on unmount
- Wavesurfer: `wavesurfer.destroy()` when video changes
- Event listeners: cleanup in useEffect return

**URL sources**:
- `source: 'file' | 'url'` 필드로 구분
- `file: File | null` (URL sources는 null)
- URL sources는 revokeObjectURL 스킵

### 4. Video Player Context

```typescript
// Access player instance
const { player, play, pause, seek, togglePlay } = useVideoPlayerContext();

// Always check existence
if (!player) return;
player.currentTime(time);
```

### 5. URL Download Strategy

**Platform detection** (`src/lib/platformDetector.ts`):
- Chzzk → Streamlink downloader
- YouTube → yt-dlp downloader
- Generic → yt-dlp (fallback)

**Two-phase process**:
1. Download/extract segment → temp file
2. FFmpeg timestamp reset → final file

**Progress**: SSE (Server-Sent Events)
- Phase 1 (downloading): 0-90%
- Phase 2 (processing): 90-100%

## Development Workflow

### Adding Features
1. Add state to Zustand store with validation
2. Create feature folder with components/hooks/utils
3. Use context only if needed (avoid prop drilling)
4. Add unit tests for logic, E2E tests for workflows
5. Run `npm run type-check` before committing

### Debugging Timeline Sync
- Check `isScrubbing` and `isSeeking` flags
- Verify timeupdate handlers ignore events during user interaction
- Use refs for stable closures in event handlers

### Working with video.js
- Access player via `useVideoPlayerContext()`
- Always check player exists before calling methods
- Dispose player on component unmount

## Important Constraints

### Supported Formats
MP4, WebM, OGG, MOV, M4V, AVI, WMV, MKV, FLV, TS, 3GP, 3G2, MPEG, MPG (17 formats)

### File Size Limits
- **Recommended**: 500MB (safe)
- **Warning**: 1GB (caution)
- **Soft max**: 2GB (memory check)
- **Hard max**: 5GB (absolute limit)

### Keyframe Accuracy
MP4Box trimming finds the nearest keyframe, resulting in ±1-2 second accuracy (not frame-accurate). This is a trade-off for fast, no-encoding trimming.

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

**For detailed information, always refer to:**
- **`.docs/PROJECT.md`** - Complete project documentation (architecture, technical details, performance)
- **`.docs/HISTORY.md`** - Development history and architectural decisions
- **`scripts/README.md`** - Scripts documentation

This file (CLAUDE.md) is a quick reference guide for Claude Code. For comprehensive technical details, patterns, and implementation specifics, see PROJECT.md.
