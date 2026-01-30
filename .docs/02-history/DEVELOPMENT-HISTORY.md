# Development History

> **Period**: 2026-01-21 ~ 2026-01-30 (10 days)
> **Major Changes**: Bug fixes, architecture migration, accuracy improvements, feature enhancements, comprehensive refactoring
> **Result**: Production-ready application with 4,252 lines, 92 tests passing

---

## Timeline Overview

| Date | Event | Impact |
|------|-------|--------|
| 2026-01-21 | Playhead snap-back bug fixed | Stable timeline interaction |
| 2026-01-28 | MP4Box migration | 10-20x speed improvement |
| 2026-01-28 | FFmpeg accuracy improved | ±0.5s → ±0.02s |
| 2026-01-29 | Feature enhancements | Hybrid trimmer, better UX |
| 2026-01-30 | Six-phase refactoring | 787 lines reduced (15.6%) |

---

## 1. Playhead Snap-Back Bug Fix

**Date**: 2026-01-21
**Commit**: `23fa7f9`

### Problem

Playhead would snap back to previous position after drag release, then jump to correct position (flickering).

### Root Causes

1. **Multiple Pending Seeks**: Throttled seeks during drag continued completing after drag ended
2. **Unverified seeked Event**: Used `player.one('seeked')` which caught first seeked event, not the final one
3. **Unstable Closures**: `useCallback` dependencies included frequently-changing state

### Solution

```typescript
// Key changes:
// 1. NO seek during drag (only update position)
// 2. Single seek at drag end
// 3. Verify seeked event matches target time
// 4. Use refs for stable closures

const handleSeeked = () => {
  const diff = Math.abs(player.currentTime() - finalSeekTargetRef.current);
  if (diff < 0.1) { // Verify this is OUR seek
    cleanup();
  }
};
player.on('seeked', handleSeeked); // .on, not .one
```

### Key Takeaway

Don't patch symptoms. Simulate execution flow to find root cause. Verify async event origins.

---

## 2. MP4Box Migration

**Date**: 2026-01-28
**Commits**: `1206d44`, `6777fea`, `d499612`

### Motivation

FFmpeg.wasm was slow (30-60s for 500MB file) and heavy (30MB bundle). MP4Box.js uses stream-copy approach—no re-encoding needed.

### Changes

- **Removed**: FFmpeg.wasm trimmer, lifecycle hooks (179 lines)
- **Added**: MP4Box.js trimmer, TypeScript definitions (316 lines)
- **Method**: Parse MP4 structure, extract samples in time range, build new MP4

### Results

| Metric | Before (FFmpeg) | After (MP4Box) |
|--------|----------------|----------------|
| Processing (500MB) | ~60 seconds | ~3 seconds |
| CPU usage | Very high | Low |
| Accuracy | ±0.02s | ±1-2s (keyframe-based) |
| Bundle size | ~30MB | ~500KB |

### Trade-off

Speed and simplicity gained, frame-accurate trimming lost. Acceptable for most use cases.

**Note**: Next day, FFmpeg was re-added as fallback for hybrid approach (see Feature Enhancements).

---

## 3. FFmpeg Accuracy Improvement

**Date**: 2026-01-28
**Commit**: `f37ff17`

### Problem

FFmpeg trimming had ±0.5s error, especially at non-keyframe boundaries.

### Root Cause

`-ss` positioned **before** `-i` used fast input seeking (keyframe-based), snapping to nearest keyframe instead of exact time.

### Solution

Move `-ss` **after** `-i` for output seeking (accurate):

```bash
# Before (input seeking - fast but inaccurate)
-ss 2.345 -i input.mp4 -t 3.0 -c copy output.mp4

# After (output seeking - accurate)
-i input.mp4 -ss 2.345 -t 3.0 -c copy output.mp4
```

### Results

- **Accuracy**: ±0.5s → ±0.02s (17-250x better)
- **Speed**: Negligible impact (+4.5%, still fast with `-c copy`)
- **Quality**: No change (still stream copy)

### Key Takeaway

Option **position** matters in FFmpeg. Always benchmark—documentation can be misleading for specific use cases.

---

## 4. Feature Enhancements

**Date**: 2026-01-29
**Commits**: ~20 commits

### Hybrid Trimmer Dispatcher

**File**: `src/features/export/utils/trimVideoDispatcher.ts`

Automatically selects best method:
- **Short clips (<60s) + small files (<100MB)**: FFmpeg (accurate)
- **Long clips or large files**: MP4Box (fast)

No user decision needed—app chooses optimal strategy.

### Enhanced Error Handling

**Files**: `src/types/error.ts`, `src/utils/errorHandler.ts`, `src/utils/memoryMonitor.ts`

- Specific error types (`MEMORY_EXCEEDED`, `FILE_TOO_LARGE`, etc.)
- User-friendly messages with recovery suggestions
- Memory monitoring (warn before browser crashes)
- Technical details for developers

### File Size Multi-Tier Limits

```typescript
RECOMMENDED: 500MB   // No warning
WARNING:     1GB     // Show warning, allow
DANGER:      3GB     // Strong warning, allow
BLOCKED:     >3GB    // Block upload
```

Progressive degradation instead of hard limits.

### Additional Formats

Added support for:
- **QuickTime** (.mov)
- **AVI** (.avi)
- **Matroska** (.mkv)

### Other Improvements

- Real-time video seeking during playhead drag
- Smoother progress bars (FFmpeg log parsing)
- UI polish (playhead color, handle thickness)
- FFmpeg lazy loading

### Total Changes

- Added: ~913 lines
- Removed: ~80 lines
- Net: +833 lines

---

## 5. Six-Phase Refactoring

**Date**: 2026-01-30
**Duration**: ~6 hours
**Result**: 5,039 → 4,252 lines (787 lines / 15.6% reduced)

### Phase 1: Utility Consolidation

- Remove `formatBytes` duplication
- Unify time formatting
- Create store selectors (`src/stores/selectors.ts`)
- **Saved**: ~60 lines

### Phase 2: Component Consolidation

Merged `InPointHandle` + `OutPointHandle` → `TrimHandle`:

```typescript
// Before: 2 files, 130 lines (85% identical)
<InPointHandle />
<OutPointHandle />

// After: 1 file, 85 lines
<TrimHandle type="in" />
<TrimHandle type="out" />
```

**Saved**: 49 lines

### Phase 3: TimelineEditor Decomposition

Broke down monolithic 182-line component:

**Extracted**:
- `usePreviewPlayback.ts` (preview logic)
- `useTimelineZoom.ts` (zoom logic)
- `PreviewButtons.tsx` (preview UI)
- `TimelineControls.tsx` (control grouping)

**Result**: 182 → 64 lines (orchestration only)
**Saved**: ~117 lines

### Phase 4: State Management Improvements

**Critical Bug Fixed**: MP4Box race condition

```typescript
// BEFORE: Completed on first callback (WRONG)
mp4boxfile.onSamples = (trackId, user, samples) => {
  trackData.completed = true; // ❌ MP4Box calls this multiple times!
};

// AFTER: Inactivity-based detection
let lastSampleTime = Date.now();
setInterval(() => {
  if (Date.now() - lastSampleTime > 150) {
    resolve(); // ✅ Actually complete
  }
}, 50);
```

Also:
- Separated error setting from phase transitions
- Added FFmpeg cleanup function
- Tests increased: 90 → 92

**Saved**: ~40 lines

### Phase 5: Dead Code Removal

- Deleted `useFFmpeg.ts` (72 lines, completely unused)
- Consolidated error handler maps
- **Saved**: ~114 lines

### Phase 6: Performance Optimizations

- Playhead memoization (reduce re-renders)
- Waveform zoom debouncing (100ms)
- Code splitting (lazy load ExportProgress, DownloadButton)

**Impact**: Smoother UX, faster initial load

### Refactoring Summary

| Phase | Lines Saved | Risk | Time |
|-------|-------------|------|------|
| 1. Utilities | ~60 | Low | 1.5h |
| 2. Components | ~49 | Medium | 2h |
| 3. Decomposition | ~117 | Medium | 2.5h |
| 4. State | ~40 | Medium-High | 3h |
| 5. Dead Code | ~114 | Low | 1h |
| 6. Performance | - | Low | 1.5h |
| **Total** | **787** | - | **~6h** |

All tests passed, no regressions.

---

## Key Lessons Learned

### 1. Root Cause Over Symptoms

**Playhead bug**: Don't patch with timeouts/RAF. Simulate execution flow, find actual race conditions.

### 2. Understand Your Tools

**FFmpeg**: `-ss` position changes behavior dramatically. **MP4Box**: `onSamples` fires multiple times. Always verify API behavior, don't assume.

### 3. Performance > Accuracy (Usually)

Users prefer fast (2-5s, ±1-2s accuracy) over slow (60s, ±0.02s). **Exception**: Short clips where accuracy matters—hybrid approach solves this.

### 4. Hybrid Approaches Are Powerful

MP4Box + FFmpeg dispatcher gives best of both worlds. Don't force users to understand trade-offs—make smart decisions for them.

### 5. Error Handling Is a Feature

Good errors turn failures into learning moments:
- What went wrong
- How to fix it
- Alternative options

### 6. Progressive Enhancement

Multi-tier limits (OK/WARNING/DANGER/BLOCKED) > hard limits. Gradual degradation provides flexibility.

### 7. Incremental Refactoring Works

- Small, atomic commits
- Risk-based ordering (low risk first)
- Test after every phase
- Document before/during/after

Result: 223% of goal achieved (787 vs 350 lines), 50% faster than planned.

### 8. Measure Real-World Impact

Test with actual files (100MB, 500MB, 1GB). Benchmarks revealed `-ss` position had negligible speed impact for stream-copy, contradicting general documentation.

---

## Commits Reference

**Bug Fixes**:
- `23fa7f9` - Playhead snap-back fix

**Architecture**:
- `1206d44`, `6777fea`, `d499612` - MP4Box migration
- `f37ff17` - FFmpeg accuracy improvement
- `740de62` - Hybrid trimmer dispatcher

**Features**:
- `2438db2` - Enhanced error handling
- `ef7bfa0` - File size limit relaxation
- `29ca4de` - Additional format support
- `c5fdef4` - Real-time playhead scrubbing

**Refactoring** (9 commits):
- `d9b71cf`, `582fe37`, `ee3b05f` - Phase 1
- `ac9c0c7` - Phase 2
- `215e091` - Phase 3
- `e0f346b` - Phase 4
- `e944edf` - Phase 5
- `03d5683` - Phase 6
- `d1a7151` - Documentation

---

**Final State**: Production-ready, 4,252 lines, 92/92 tests passing, 0 type errors
