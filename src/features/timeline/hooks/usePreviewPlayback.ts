import { useCallback, useEffect, useRef } from 'react';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';

/**
 * Hook for managing preview playback functionality
 * Provides preview full and preview edges (first 5s + last 5s) capabilities
 */
export function usePreviewPlayback(inPoint: number, outPoint: number) {
  const previewCheckTimeRef = useRef<(() => void) | null>(null);
  const { seek, togglePlay, player } = useVideoPlayerContext();

  /**
   * Preview the full selected segment
   */
  const handlePreview = useCallback(() => {
    seek(inPoint);
    if (player?.paused()) {
      togglePlay();
    }
  }, [inPoint, seek, togglePlay, player]);

  /**
   * Preview edges: plays first 5s, then jumps to last 5s
   * For short segments (<10s), plays the full segment instead
   */
  const handlePreviewEdges = useCallback(() => {
    // Clean up any existing preview listener
    if (previewCheckTimeRef.current && player) {
      player.off('timeupdate', previewCheckTimeRef.current);
      previewCheckTimeRef.current = null;
    }

    const segmentDuration = outPoint - inPoint;

    // For short segments, just play the full thing
    if (segmentDuration < 10) {
      handlePreview();
      return;
    }

    const firstSegmentEnd = inPoint + 5;
    let isTransitioning = false;

    // Start playback from beginning
    seek(inPoint);
    if (player?.paused()) {
      togglePlay();
    }

    // Monitor playback and jump to last 5s when first 5s completes
    const checkTime = () => {
      if (!player) return;

      const currentTime = player.currentTime();
      if (currentTime !== undefined && currentTime >= firstSegmentEnd && !isTransitioning) {
        isTransitioning = true;
        const secondSegmentStart = outPoint - 5;
        player.pause();
        seek(secondSegmentStart);

        // Wait for seek to complete before resuming playback
        const seekedHandler = () => {
          player.play();
          player.off('seeked', seekedHandler);
        };
        player.on('seeked', seekedHandler);

        // Clean up timeupdate listener
        player.off('timeupdate', checkTime);
        previewCheckTimeRef.current = null;
      }
    };

    previewCheckTimeRef.current = checkTime;
    player?.on('timeupdate', checkTime);
  }, [inPoint, outPoint, seek, togglePlay, player, handlePreview]);

  // Cleanup preview listener on unmount
  useEffect(() => {
    return () => {
      if (previewCheckTimeRef.current && player) {
        player.off('timeupdate', previewCheckTimeRef.current);
        previewCheckTimeRef.current = null;
      }
    };
  }, [player]);

  return {
    handlePreview,
    handlePreviewEdges,
  };
}
