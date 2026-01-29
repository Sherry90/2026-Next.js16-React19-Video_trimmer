/**
 * Reusable Zustand store selectors
 *
 * These hooks provide convenient access to store state and actions,
 * reducing boilerplate and improving performance with proper equality checks.
 */

import { useStore } from './useStore';
import { useShallow } from 'zustand/react/shallow';
import type { TimelineState, PlayerState, ProcessingState } from '@/types/store';

// ==================== Timeline Selectors ====================

/**
 * Get all timeline state values
 * Uses shallow equality to prevent unnecessary re-renders
 */
export function useTimelineState() {
  return useStore(
    useShallow((state) => ({
      inPoint: state.timeline.inPoint,
      outPoint: state.timeline.outPoint,
      playhead: state.timeline.playhead,
      isInPointLocked: state.timeline.isInPointLocked,
      isOutPointLocked: state.timeline.isOutPointLocked,
      zoom: state.timeline.zoom,
    }))
  );
}

/**
 * Get timeline actions only (never causes re-renders)
 */
export function useTimelineActions() {
  return useStore(
    useShallow((state) => ({
      setInPoint: state.setInPoint,
      setOutPoint: state.setOutPoint,
      setPlayhead: state.setPlayhead,
      setInPointLocked: state.setInPointLocked,
      setOutPointLocked: state.setOutPointLocked,
      setZoom: state.setZoom,
      resetTimeline: state.resetTimeline,
    }))
  );
}

/**
 * Get specific trim points (common pattern)
 */
export function useTrimPoints() {
  return useStore(
    useShallow((state) => ({
      inPoint: state.timeline.inPoint,
      outPoint: state.timeline.outPoint,
    }))
  );
}

// ==================== Video File Selectors ====================

/**
 * Get video file (returns null if not loaded)
 */
export function useVideoFile() {
  return useStore((state) => state.videoFile);
}

/**
 * Get video URL (common pattern)
 */
export function useVideoUrl() {
  return useStore((state) => state.videoFile?.url);
}

/**
 * Get video duration (defaults to 0 if not available)
 */
export function useVideoDuration() {
  return useStore((state) => state.videoFile?.duration ?? 0);
}

// ==================== Player Selectors ====================

/**
 * Get all player state values
 */
export function usePlayerState() {
  return useStore(
    useShallow((state) => ({
      isPlaying: state.player.isPlaying,
      currentTime: state.player.currentTime,
      volume: state.player.volume,
      isMuted: state.player.isMuted,
      isScrubbing: state.player.isScrubbing,
    }))
  );
}

/**
 * Get player actions only
 */
export function usePlayerActions() {
  return useStore(
    useShallow((state) => ({
      setIsPlaying: state.setIsPlaying,
      setCurrentTime: state.setCurrentTime,
      setVolume: state.setVolume,
      setIsMuted: state.setIsMuted,
      setIsScrubbing: state.setIsScrubbing,
    }))
  );
}

/**
 * Get current playback time (common pattern)
 */
export function useCurrentTime() {
  return useStore((state) => state.player.currentTime);
}

// ==================== Phase & Processing Selectors ====================

/**
 * Get current app phase
 */
export function usePhase() {
  return useStore((state) => state.phase);
}

/**
 * Get all processing progress values
 */
export function useProcessing() {
  return useStore(
    useShallow((state) => ({
      uploadProgress: state.processing.uploadProgress,
      trimProgress: state.processing.trimProgress,
      waveformProgress: state.processing.waveformProgress,
    }))
  );
}

/**
 * Get specific progress value
 */
export function useUploadProgress() {
  return useStore((state) => state.processing.uploadProgress);
}

export function useTrimProgress() {
  return useStore((state) => state.processing.trimProgress);
}

export function useWaveformProgress() {
  return useStore((state) => state.processing.waveformProgress);
}

// ==================== Error & Export Selectors ====================

/**
 * Get error state
 */
export function useError() {
  return useStore(
    useShallow((state) => ({
      errorMessage: state.error.errorMessage,
      errorCode: state.error.errorCode,
    }))
  );
}

/**
 * Get export result
 */
export function useExportState() {
  return useStore(
    useShallow((state) => ({
      outputUrl: state.export.outputUrl,
      outputFilename: state.export.outputFilename,
    }))
  );
}

// ==================== Common Actions ====================

/**
 * Get frequently used actions (phase, error, export)
 */
export function useCommonActions() {
  return useStore(
    useShallow((state) => ({
      setPhase: state.setPhase,
      setError: state.setError,
      clearError: state.clearError,
      setExportResult: state.setExportResult,
      clearExportResult: state.clearExportResult,
      reset: state.reset,
      // Combined actions
      setErrorAndTransition: state.setErrorAndTransition,
      setExportResultAndComplete: state.setExportResultAndComplete,
    }))
  );
}

/**
 * Get progress setters
 */
export function useProgressActions() {
  return useStore(
    useShallow((state) => ({
      setUploadProgress: state.setUploadProgress,
      setTrimProgress: state.setTrimProgress,
      setWaveformProgress: state.setWaveformProgress,
    }))
  );
}
