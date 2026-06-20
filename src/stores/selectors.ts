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

// Player Selectors
export const usePlayerActions = createStateSelector((state) => ({
  setIsPlaying: state.setIsPlaying,
  setCurrentTime: state.setCurrentTime,
  setVolume: state.setVolume,
  setIsMuted: state.setIsMuted,
  setIsScrubbing: state.setIsScrubbing,
}));

// Narrow player selectors — timeupdate fires ~4x/s, so subscribe each control
// to only the field it needs (Scrubber/TimeDisplay re-render per tick, the rest don't).
export const usePlayerCurrentTime = createSimpleSelector((state) => state.player.currentTime);
export const usePlayerIsPlaying = createSimpleSelector((state) => state.player.isPlaying);
export const useSelectedQuality = createSimpleSelector((state) => state.selectedQuality);
export const usePlayerVolume = createStateSelector((state) => ({
  volume: state.player.volume,
  isMuted: state.player.isMuted,
}));

// Phase & Processing Selectors
export const usePhase = createSimpleSelector((state) => state.phase);

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
  setProgress: state.setProgress,
}));
