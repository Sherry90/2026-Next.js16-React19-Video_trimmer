import { createSimpleSelector, createStateSelector } from '../selectorFactory';

// ── player ──
// timeupdate는 초당 ~4회 발생 → 컨트롤마다 필요한 필드만 좁게 구독해
// Scrubber/TimeDisplay만 tick마다 재렌더되고 나머지는 안 되게 한다.
export const usePlayerCurrentTime = createSimpleSelector((s) => s.player.currentTime);
export const usePlayerIsPlaying = createSimpleSelector((s) => s.player.isPlaying);
export const usePlayerVolume = createStateSelector((s) => ({
  volume: s.player.volume,
  isMuted: s.player.isMuted,
}));

export const usePlayerActions = createStateSelector((s) => ({
  setIsPlaying: s.setIsPlaying,
  setCurrentTime: s.setCurrentTime,
  setVolume: s.setVolume,
  setIsMuted: s.setIsMuted,
  setIsScrubbing: s.setIsScrubbing,
}));

// ── error ──
/** 에러 상태 전체(hasError/message/code/technicalDetails). */
export const useErrorState = createStateSelector((s) => ({
  hasError: s.error.hasError,
  errorMessage: s.error.errorMessage,
  errorCode: s.error.errorCode,
  technicalDetails: s.error.technicalDetails,
}));

export const useErrorActions = createStateSelector((s) => ({
  setError: s.setError,
  clearError: s.clearError,
  setErrorAndTransition: s.setErrorAndTransition,
}));

// ── export ──
/** 내보내기 결과(출력 URL/파일명). */
export const useExportResult = createStateSelector((s) => ({
  outputUrl: s.export.outputUrl,
  outputFilename: s.export.outputFilename,
}));

export const useExportActions = createStateSelector((s) => ({
  setExportResult: s.setExportResult,
  clearExportResult: s.clearExportResult,
  setExportResultAndComplete: s.setExportResultAndComplete,
}));
