# Trimming Accuracy Improvement

> **Date**: 2026-01-28
> **Type**: Technical Investigation & Improvement
> **Impact**: Medium - Improved FFmpeg trimming from ±0.5s to ±0.02s accuracy
> **Status**: ✅ Completed - Achieved near-perfect accuracy

---

## Overview

After migrating to MP4Box.js (see `002-mp4box-migration.md`), FFmpeg.wasm was retained as a fallback option. However, testing revealed accuracy issues with the FFmpeg implementation. This document chronicles the investigation and successful resolution of these issues.

**Commit**: `f37ff17` - feat: 비디오 트리밍 정확도 개선 (±0.5초 → ±0.02초)

---

## Background

### Why This Mattered

Even though MP4Box.js became the primary trimming method, FFmpeg.wasm was still valuable for:
- **Fallback option** when MP4Box fails
- **Format flexibility** for non-MP4 videos
- **Potential hybrid approach** (later implemented)

Poor FFmpeg accuracy would undermine its usefulness as a fallback, so improving it was important.

### Initial Problem

Users noticed that FFmpeg-trimmed videos didn't start/end exactly where expected:
- Trimming from 2.5s sometimes started at 2.0s
- Short clips (< 1 second) had 50%+ duration errors
- Inconsistent behavior depending on trim points

---

## Investigation Process

### Phase 0.1: Measuring Current Accuracy

#### Test Environment

- **Date**: 2026-01-28
- **FFmpeg Version**: @ffmpeg/ffmpeg@0.12.10 (ffmpeg 8.0)
- **Test File**: test-video.mp4 (H.264, 720p, 30fps)
- **Keyframe Interval**: 2 seconds (GOP 60 / 30fps = 2s)
- **Video Duration**: 300 seconds (5 minutes)

#### Original FFmpeg Command

```typescript
const ffmpegArgs = [
  '-ss', startTime.toString(),     // ❌ BEFORE -i (input seeking)
  '-i', inputFileName,
  '-t', duration.toString(),
  '-c', 'copy',
  '-avoid_negative_ts', 'make_zero',
  outputFileName
];
```

**Characteristics**:
- `-ss` positioned **before** `-i` → Fast input seeking (keyframe-based)
- `-c copy` → Stream copy (no re-encoding)

#### Test Results

| Test Case | Start (s) | End (s) | Expected (s) | Actual (s) | Error (s) | Error (%) | Assessment |
|-----------|-----------|---------|--------------|------------|-----------|-----------|------------|
| Short clip | 2.000 | 5.000 | 3.000 | 3.019 | +0.019 | +0.63% | ✅ Very accurate |
| Medium clip | 30.000 | 45.000 | 15.000 | 15.023 | +0.023 | +0.15% | ✅ Very accurate |
| Long clip | 120.000 | 180.000 | 60.000 | 60.024 | +0.024 | +0.04% | ✅ Very accurate |
| Decimal precision | 2.345 | 5.678 | 3.333 | 3.703 | +0.370 | +11.10% | ⚠️ Moderate error |
| Very short clip | 0.500 | 1.500 | 1.000 | 1.509 | +0.509 | +50.90% | ❌ Large error |

#### Key Findings

**1. Accuracy at Keyframe Boundaries (✅ Excellent)**
- Start times at **2.000s, 30.000s, 120.000s** (all keyframe boundaries with 2s interval)
- Error range: **±0.02s or less** (0.04% ~ 0.63%)
- **Conclusion**: Nearly perfect accuracy at keyframe boundaries

**2. Accuracy Between Keyframes (⚠️ ~ ❌ Problematic)**
- Start time at **2.345s** (between 2s and 4s keyframes)
- Error: **+0.370s (11.10%)**
- Start time at **0.500s** (between 0s and 2s keyframes)
- Error: **+0.509s (50.90%)**
- **Conclusion**: Significant errors when not starting at keyframes

**3. Root Cause**

With `-ss` before `-i`, FFmpeg uses **input seeking**:

1. **Fast input seeking**: Doesn't decode entire file → Fast
2. **Keyframe-based seeking**: Seeks to **nearest previous keyframe**, not exact time
3. Example: Request 2.345s → Actually starts at 2s keyframe → Longer output

**Visualization**:
```
Keyframes:     0s      2s      4s      6s
Request:            2.345s → 5.678s (3.333s expected)
Actual start:       2s (snapped to keyframe)
Actual duration:    ~3.7s (starts at 2s, then adds duration)
```

**4. User Impact**
- Videos with 2-second keyframe intervals:
  - Trimming at whole seconds (2, 30, 120): ✅ Perfect
  - Trimming at decimal seconds (2.345, 0.5): ⚠️ ~ ❌ Errors occur
- **Real use case**: Most videos use 2-second keyframe intervals
- **User perception**: "Start at 2.5s" actually starts at 2.0s

**Summary**:
- Average error: ±0.189s
- Maximum error: ±0.509s (very short clips)
- **Clear correlation with keyframe intervals**

---

### Phase 0.2: Root Cause Analysis

#### Time Precision Verification

**Code Review**: `src/features/export/utils/trimVideoFFmpeg.ts`

```typescript
// Current implementation
const ffmpegArgs = [
  '-ss', startTime.toString(),  // Does this preserve decimals?
  '-i', inputFileName,
  '-t', duration.toString(),    // Does this preserve decimals?
  '-c', 'copy',
  '-avoid_negative_ts', 'make_zero',
  outputFileName
];
```

**Verification**:
- ✅ `startTime.toString()`: 2.345 → "2.345" (decimals preserved)
- ✅ FFmpeg receives correct decimal values
- ❌ Issue is not with precision, but with **seeking method**

#### FFmpeg Option Analysis

**Current approach**: `-ss` before `-i`
- **Advantage**: Fast processing (doesn't decode before seek point)
- **Disadvantage**: Keyframe-based seeking (inaccurate between keyframes)

**Alternative**: `-ss` after `-i`
- **Advantage**: Accurate seeking (decodes to exact frame)
- **Disadvantage**: Potentially slower (decodes before seek point)

---

### Phase 0.3: Testing Improvement Methods

#### ✅ Method 1: Change `-ss` Position (ADOPTED)

**Command**:
```typescript
// Before (current - input seeking)
['-ss', startTime, '-i', input, '-t', duration, '-c', 'copy', '-avoid_negative_ts', 'make_zero']

// After (output seeking)
['-i', input, '-ss', startTime, '-t', duration, '-c', 'copy']
```

**Test Results**:

| Test Case | Expected (s) | Method Before Error | Method 1 Error | Improvement |
|-----------|--------------|---------------------|----------------|-------------|
| Decimal precision | 3.333 | +0.370s (11.10%) | **+0.022s (0.66%)** | **17x better** |
| Very short clip | 1.000 | +0.509s (50.90%) | **-0.002s (0.20%)** | **250x better** |

**Detailed Analysis**:
- **Accuracy**: ✅ **Dramatically improved** (within ±0.02s, nearly perfect)
- **Speed**: ✅ **Almost identical** (0.044s vs 0.046s)
- **Video stream**: ✅ **Normal** (no drops, code comment concerns were unfounded)
- **Audio stream**: ✅ **Normal**
- **Mechanism change**:
  - **Before**: Input seeking (keyframe-based → inaccurate but fast)
  - **After**: Output seeking (accurate seeking → accurate and still fast)
- **Conclusion**: ✅ **ADOPTED - Perfect solution!**

#### ❌ Method 2: `-accurate_seek` Option (REJECTED)

**Command**:
```typescript
['-ss', startTime, '-i', input, '-accurate_seek', '-t', duration, '-c', 'copy']
```

**Test Result**:
- **Status**: ❌ **Command error**
- **Error**: `Option accurate_seek cannot be applied to output url -- you are trying to apply an input option to an output file or vice versa`
- **Cause**: `-accurate_seek` is an output option but used in input section
- **Conclusion**: ❌ **REJECTED - Command syntax error**

#### ❌ Method 3: `-copyts` + `-start_at_zero` (REJECTED)

**Command**:
```typescript
['-ss', startTime, '-i', input, '-t', duration, '-c', 'copy', '-copyts', '-start_at_zero']
```

**Test Results**:

| Test Case | Expected (s) | Actual (s) | Error (s) |
|-----------|--------------|------------|-----------|
| Decimal precision | 3.333 | 1.347 | **-1.986 (-59%)** |
| Very short clip | 1.000 | 1.022 | +0.022 (+2%) |

- **Accuracy**: ❌ **Actually worse** (timestamp preservation causes duration calculation errors)
- **Timestamps**: ❌ **Issues** (`time=00:00:00.00` displayed)
- **Conclusion**: ❌ **REJECTED - Inaccurate**

#### Methods 4-5: Time Format Changes, Two-Stage `-ss`

Method 1 worked perfectly, so additional tests were unnecessary.

---

## Solution Implementation

### Changes Made

**File**: `src/features/export/utils/trimVideoFFmpeg.ts`

```typescript
// BEFORE (lines 45-61)
const ffmpegArgs = [
  '-ss', startTime.toString(),     // ❌ Input seeking
  '-i', inputFileName,
  '-t', duration.toString(),
  '-c', 'copy',
  '-avoid_negative_ts', 'make_zero',  // Can be removed (unnecessary)
  outputFileName
];

// AFTER
const ffmpegArgs = [
  '-i', inputFileName,              // ✅ Input first
  '-ss', startTime.toString(),      // ✅ Output seeking
  '-t', duration.toString(),
  '-c', 'copy',
  outputFileName
];
```

**Documentation Update**:
```typescript
/**
 * Trim video using FFmpeg.wasm with stream copy (no re-encoding)
 *
 * Uses output seeking (-ss after -i) for accurate trimming (±0.02s)
 *
 * Limitations:
 * - Recommended file size: < 500MB
 * - Maximum file size: ~1-2GB (depending on browser memory)
 * - Accuracy: ±0.02 seconds (virtually frame-accurate for 30fps video)
 */
```

---

## Results

### Before vs. After Comparison

| Metric | Before (Input Seeking) | After (Output Seeking) |
|--------|------------------------|------------------------|
| Command | `-ss [t] -i input -t [d] -c copy` | `-i input -ss [t] -t [d] -c copy` |
| Seeking method | Input seeking (keyframe-based) | Output seeking (accurate seeking) |
| At keyframe boundaries | ±0.02s ✅ | ±0.02s ✅ |
| Between keyframes | ±0.37s ⚠️ | ±0.02s ✅ |
| Very short clips | ±0.51s ❌ | ±0.00s ✅ |
| Speed (15s trim) | 0.044s | 0.046s |
| Video stream drops | None ✅ | None ✅ |
| Re-encoding required | None ✅ | None ✅ |

### Performance Impact

**Speed**: Virtually no change
- Before: 0.044s for 15-second trim
- After: 0.046s for 15-second trim
- Difference: +0.002s (negligible, only 4.5% slower)

**Accuracy**: Dramatic improvement
- Before: ±0.189s average, ±0.509s maximum
- After: ±0.02s or better (all cases)
- Improvement: **17-250x better** depending on test case

**Quality**: No change
- Still using stream copy (no re-encoding)
- Original quality preserved
- No generation loss

---

## Why This Worked

### Input Seeking vs. Output Seeking

**Input Seeking** (`-ss` before `-i`):
```
1. Seek to nearest keyframe before requested time
2. Start reading from that keyframe
3. Decode and output everything after seek point
Result: Fast but inaccurate (keyframe-aligned)
```

**Output Seeking** (`-ss` after `-i`):
```
1. Read file from beginning (or optimized start)
2. Decode frames
3. Start outputting from exact requested time
Result: Accurate but potentially slower (frame-accurate)
```

**Our Discovery**:
For stream-copy operations with `-c copy`, output seeking maintains nearly the same speed as input seeking while providing much better accuracy. The speed concerns in FFmpeg documentation don't apply as strongly to stream-copy workflows.

---

## Lessons Learned

### 1. FFmpeg Options Have Nuances

The **position** of options in FFmpeg commands matters significantly:
- `-ss` before `-i`: Fast keyframe-based seeking
- `-ss` after `-i`: Accurate frame-based seeking

Both have use cases; choosing depends on your priority (speed vs. accuracy).

### 2. Test with Real-World Cases

Our test suite included:
- ✅ Keyframe boundaries (2s, 30s, 120s)
- ✅ Between keyframes (2.345s, 0.5s)
- ✅ Short clips (1s)
- ✅ Long clips (60s)

This comprehensive testing revealed the pattern that keyframe position mattered.

### 3. Documentation Can Be Misleading

FFmpeg documentation suggested output seeking would be "much slower," but:
- Reality: Only ~4% slower for our use case
- Reason: Stream copy doesn't involve heavy decoding
- Takeaway: **Always benchmark your specific scenario**

### 4. Stream Copy Is Forgiving

Because we're using stream copy (`-c copy`), not transcoding:
- Decoding overhead is minimal
- Output seeking doesn't hurt performance much
- We get accuracy without sacrificing speed

### 5. User Perception Matters

±0.5s error might seem small, but:
- For a 1-second clip, it's 50% error
- For precise editing, it's frustrating
- **Achieving ±0.02s makes the tool feel professional**

---

## Testing Methodology

### Test Utility Created

**Files Added**: `public/test-utils/accuracy-test.js`, `.docs/accuracy-test-guide.md`

**Commit**: `a7143b0` - docs: 정확도 테스트 문서 및 개발 도구 추가

The test utility provided:
1. Predefined test cases
2. Console-based result recording
3. Automated report generation
4. Markdown table output

**Usage**:
```javascript
// In browser console (dev mode)
accuracyTest.listTestCases()
// Trim video manually in UI
accuracyTest.recordResult(0, 3.019)  // Record actual duration
accuracyTest.generateReport(results)  // Generate markdown table
```

This methodology was reusable and made systematic testing easy.

---

## Future Considerations

### Re-encoding Mode (NOT Implemented)

We considered adding a "high-accuracy re-encoding mode":

```typescript
export type TrimMode = 'fast' | 'accurate';

if (mode === 'accurate') {
  await ffmpeg.exec([
    '-i', input,
    '-ss', startTime,
    '-t', duration,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',  // Fast encoding
    '-crf', '18',            // High quality
    '-c:a', 'copy',          // Copy audio
    output
  ]);
}
```

**Trade-offs**:
- **Speed**: 2-5s → 1-5 minutes (100-1000x slower)
- **Quality**: Lossless → CRF 18 (slight loss)
- **File size**: Same → Variable
- **Core value**: Compromised

**Decision**: NOT implemented because Method 1 (output seeking) achieved near-perfect accuracy (±0.02s) without re-encoding. Re-encoding would sacrifice speed (core value) for minimal additional accuracy gain.

---

## Conclusion

### Success Metrics

- [x] Error ±0.5s or less: ✅ **Achieved** (±0.02s)
- [x] No speed degradation: ✅ **Achieved** (+0.002s only)
- [x] No re-encoding needed: ✅ **Achieved**
- [x] No video stream drops: ✅ **Achieved**

### Impact

This simple one-line change (moving `-ss` after `-i`) resulted in:
- ✅ **17-250x accuracy improvement**
- ✅ **Near-frame-accurate trimming** (±0.02s)
- ✅ **Negligible speed impact** (+4.5%)
- ✅ **Maintained stream copy** (no quality loss)
- ✅ **Enhanced user experience** (professional-grade accuracy)

### Key Takeaway

**Small changes can have massive impact**. Understanding the tools you use (in this case, FFmpeg) and testing thoroughly can lead to dramatic improvements without complex solutions.

---

## Related Documents

- `.docs/02-history/002-mp4box-migration.md` - Why FFmpeg became a fallback
- `.docs/02-history/004-feature-enhancements.md` - Hybrid dispatcher using improved FFmpeg
- `.docs/03-current/ARCHITECTURE.md` - Current trimming architecture

---

**Document Status**: Historical Record
**Commit Reference**: `f37ff17`
**Test Utility**: `public/test-utils/accuracy-test.js` (available in codebase)
