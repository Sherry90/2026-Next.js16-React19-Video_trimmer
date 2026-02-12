/**
 * Reusable Zustand store selectors
 *
 * Uses factory functions to reduce boilerplate while maintaining type safety.
 */

import { createStateSelector, createSimpleSelector } from './selectorFactory';

// Timeline Selectors
export const useTimelineState = createStateSelector((state) => ({
  inPoint: state.timeline.inPoint,
  outPoint: state.timeline.outPoint,
  playhead: state.timeline.playhead,
  isInPointLocked: state.timeline.isInPointLocked,
  isOutPointLocked: state.timeline.isOutPointLocked,
  zoom: state.timeline.zoom,
}));

export const useTimelineActions = createStateSelector((state) => ({
  setInPoint: state.setInPoint,
  setOutPoint: state.setOutPoint,
  setPlayhead: state.setPlayhead,
  setInPointLocked: state.setInPointLocked,
  setOutPointLocked: state.setOutPointLocked,
  setZoom: state.setZoom,
  resetTimeline: state.resetTimeline,
}));

export const useTrimPoints = createStateSelector((state) => ({
  inPoint: state.timeline.inPoint,
  outPoint: state.timeline.outPoint,
}));

// Video File Selectors
export const useVideoFile = createSimpleSelector((state) => state.videoFile);
export const useVideoUrl = createSimpleSelector((state) => state.videoFile?.url);
export const useVideoDuration = createSimpleSelector((state) => state.videoFile?.duration ?? 0);
export const useVideoSource = createSimpleSelector((state) => state.videoFile?.source);
export const useStreamUrl = createSimpleSelector((state) => state.videoFile?.streamUrl);

// Player Selectors
export const usePlayerState = createStateSelector((state) => ({
  isPlaying: state.player.isPlaying,
  currentTime: state.player.currentTime,
  volume: state.player.volume,
  isMuted: state.player.isMuted,
  isScrubbing: state.player.isScrubbing,
}));

export const usePlayerActions = createStateSelector((state) => ({
  setIsPlaying: state.setIsPlaying,
  setCurrentTime: state.setCurrentTime,
  setVolume: state.setVolume,
  setIsMuted: state.setIsMuted,
  setIsScrubbing: state.setIsScrubbing,
}));

export const useCurrentTime = createSimpleSelector((state) => state.player.currentTime);

// URL Preview Selectors
export const useUrlPreview = createSimpleSelector((state) => state.urlPreview);

export const useUrlPreviewActions = createStateSelector((state) => ({
  setUrlPreview: state.setUrlPreview,
  setUrlPreviewRange: state.setUrlPreviewRange,
  clearUrlPreview: state.clearUrlPreview,
}));

// Phase & Processing Selectors
export const usePhase = createSimpleSelector((state) => state.phase);

export const useProcessing = createStateSelector((state) => ({
  uploadProgress: state.processing.uploadProgress,
  trimProgress: state.processing.trimProgress,
  waveformProgress: state.processing.waveformProgress,
}));

export const useUploadProgress = createSimpleSelector((state) => state.processing.uploadProgress);
export const useTrimProgress = createSimpleSelector((state) => state.processing.trimProgress);
export const useWaveformProgress = createSimpleSelector((state) => state.processing.waveformProgress);

// Error & Export Selectors
export const useError = createStateSelector((state) => ({
  errorMessage: state.error.errorMessage,
  errorCode: state.error.errorCode,
}));

export const useExportState = createStateSelector((state) => ({
  outputUrl: state.export.outputUrl,
  outputFilename: state.export.outputFilename,
}));

// Common Actions
export const useCommonActions = createStateSelector((state) => ({
  setPhase: state.setPhase,
  setError: state.setError,
  clearError: state.clearError,
  setExportResult: state.setExportResult,
  clearExportResult: state.clearExportResult,
  reset: state.reset,
  setErrorAndTransition: state.setErrorAndTransition,
  setExportResultAndComplete: state.setExportResultAndComplete,
}));

export const useProgressActions = createStateSelector((state) => ({
  setUploadProgress: state.setUploadProgress,
  setTrimProgress: state.setTrimProgress,
  setWaveformProgress: state.setWaveformProgress,
}));
