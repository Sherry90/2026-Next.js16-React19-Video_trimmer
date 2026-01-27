# Phase 5 UI 테스트 가이드

## 테스트 방법

### 1. 완료 화면 테스트 ("Edit Another File" 버튼)

`src/stores/useStore.ts`의 `initialState`에서:

```typescript
phase: 'completed',
error: {
  hasError: false,
  errorMessage: null,
  errorCode: null,
},
export: {
  outputUrl: 'blob:test-output',
  outputFilename: 'test_edited.mp4',
},
```

**확인 사항**:
- ✅ "Download Video" 버튼 (파란색)
- ✅ "Edit Another File" 버튼 (회색) ← **새로 추가됨**
- "Edit Another File" 클릭 → 업로드 화면으로 돌아감

---

### 2. 에러 화면 테스트 ("Start Over" 버튼)

`src/stores/useStore.ts`의 `initialState`에서:

```typescript
phase: 'error',
error: {
  hasError: true,
  errorMessage: 'Failed to process video. Please try again.',
  errorCode: 'EXPORT_ERROR',
},
export: {
  outputUrl: null,
  outputFilename: null,
},
```

**확인 사항**:
- ✅ 빨간색 에러 박스
- ✅ "Error Occurred" 제목
- ✅ 에러 코드 및 메시지
- ✅ "Start Over" 버튼 ← **이미 구현되어 있던 것**
- "Start Over" 클릭 → 업로드 화면으로 돌아감

---

### 3. 실제 운영용 설정

테스트 완료 후 다음과 같이 되돌리기:

```typescript
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
    ffmpegLoadProgress: 0,
    trimProgress: 0,
    waveformProgress: 0,
  },
  player: {
    isPlaying: false,
    currentTime: 0,
    volume: 1,
    isMuted: false,
    isScrubbing: false,
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
  isFFmpegReady: false,
};
```

---

## Phase 5 구현 완료 항목

- ✅ 완료 후 새 파일 편집 (DownloadButton에 "Edit Another File" 버튼)
- ✅ 실패 후 재시도 (ErrorDisplay에 "Start Over" 버튼)
