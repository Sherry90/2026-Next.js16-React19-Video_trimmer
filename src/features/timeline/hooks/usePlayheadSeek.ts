import { useCallback, useEffect, useRef } from 'react';
import type Player from 'video.js/dist/types/player';

/**
 * Playhead seek 검증 훅
 *
 * video.js의 seeked 이벤트를 검증하여 올바른 seek 완료를 확인
 * 드래그 종료 시 race condition을 방지하기 위한 로직
 *
 * @param player - video.js player instance
 * @returns performSeek function
 *
 * @example
 * ```typescript
 * const { performSeek } = usePlayheadSeek(player);
 *
 * // After drag end:
 * setCurrentTime(finalTime);
 * seek(finalTime);
 * performSeek(finalTime, () => {
 *   // Cleanup after seek completes
 *   setIsScrubbing(false);
 * });
 * ```
 */
export function usePlayheadSeek(player: Player | null) {
  const seekTargetRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Perform seek with verification
   *
   * Listens for seeked event and verifies the player reached
   * the target position (within 0.1s tolerance) before calling onComplete.
   *
   * @param targetTime - Target time in seconds
   * @param onComplete - Callback to execute after seek completes
   */
  const performSeek = useCallback(
    (targetTime: number, onComplete: () => void) => {
      if (!player) {
        // No player - just use timeout fallback
        setTimeout(onComplete, 500);
        return;
      }

      seekTargetRef.current = targetTime;

      const cleanup = () => {
        seekTargetRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        onComplete();
      };

      const handleSeeked = () => {
        const currentTime = player.currentTime?.();
        if (currentTime !== undefined && seekTargetRef.current !== null) {
          const diff = Math.abs(currentTime - seekTargetRef.current);

          // Only release if we're at the target position (within 0.1s)
          if (diff < 0.1) {
            player.off('seeked', handleSeeked);
            cleanup();
          }
          // Otherwise, this is a stale seek - ignore it
        }
      };

      player.on('seeked', handleSeeked);

      // Safety fallback timeout - always release after 1000ms
      timeoutRef.current = setTimeout(() => {
        player.off('seeked', handleSeeked);
        cleanup();
      }, 1000);
    },
    [player]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { performSeek };
}
