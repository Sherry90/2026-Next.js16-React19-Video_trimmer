'use client';

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { useStore } from '@/stores/useStore';
import { useVideoDuration, useTrimPoints, usePlayerActions } from '@/stores/selectors';
import { useDragHandle } from '@/features/timeline/hooks/useDragHandle';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';
import { usePlayheadSeek } from '@/features/timeline/hooks/usePlayheadSeek';
import { TIMELINE } from '@/constants/appConfig';

export const Playhead = memo(function Playhead() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Store position as PERCENTAGE (0-100), not time!
  const [draggingPosition, setDraggingPosition] = useState<number | null>(null);
  const draggingPositionRef = useRef<number | null>(null); // For stable closure
  const isDraggingRef = useRef<boolean>(false);

  // Throttle for real-time seeking during drag
  const lastSeekTimeRef = useRef<number>(0);
  const seekThrottleDelay = TIMELINE.PLAYHEAD_SEEK_THROTTLE_MS;

  const currentTime = useStore((state) => state.player.currentTime);
  const duration = useVideoDuration();
  const { inPoint, outPoint } = useTrimPoints();

  const { setCurrentTime } = usePlayerActions();
  const { seek, setIsScrubbing, player } = useVideoPlayerContext();
  const { performSeek } = usePlayheadSeek(player);

  // UI works in COORDINATES, not time
  // Memoize position calculation to avoid recalculation on every render
  const position = useMemo(() => {
    if (draggingPosition !== null) {
      return draggingPosition;
    }
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  }, [draggingPosition, currentTime, duration]);

  const startPositionRef = useRef(position);

  const handleDragStart = useCallback(() => {
    // Capture position at drag start
    const startPosition = duration > 0 ? (currentTime / duration) * 100 : 0;
    startPositionRef.current = startPosition;
    isDraggingRef.current = true;

    draggingPositionRef.current = startPosition;
    setDraggingPosition(startPosition);
    setIsScrubbing(true);

    // Reset throttle timer for real-time seeking
    lastSeekTimeRef.current = 0;

    // Force cursor style during drag to prevent flicker
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [currentTime, duration, setIsScrubbing]);

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (!containerRef.current || !isDraggingRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      if (containerWidth === 0) return;

      // Work in COORDINATES (percentage), not time!
      const deltaPercent = (deltaX / containerWidth) * 100;
      let newPosition = startPositionRef.current + deltaPercent;

      // Constrain to in/out points (convert to percentage)
      const inPointPercent = duration > 0 ? (inPoint / duration) * 100 : 0;
      const outPointPercent = duration > 0 ? (outPoint / duration) * 100 : 100;
      newPosition = Math.max(inPointPercent, Math.min(newPosition, outPointPercent));

      // Update both ref and state
      draggingPositionRef.current = newPosition;
      setDraggingPosition(newPosition);

      // Real-time video seeking during drag (throttled to 100ms)
      const now = Date.now();
      if (now - lastSeekTimeRef.current >= seekThrottleDelay) {
        lastSeekTimeRef.current = now;

        // Convert position to time and seek
        const seekTime = (newPosition / 100) * duration;

        // Update store immediately for UI responsiveness
        setCurrentTime(seekTime);

        // Seek video player
        seek(seekTime);
      }
    },
    [duration, inPoint, outPoint, seek, setCurrentTime, seekThrottleDelay]
  );

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;

    // Restore cursor immediately
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Use ref to get latest dragging position (stable closure)
    const finalPosition = draggingPositionRef.current;

    if (finalPosition !== null) {
      // Convert position → time ONCE at drag end
      const finalTime = (finalPosition / 100) * duration;

      // 1. Update store SYNCHRONOUSLY before seek
      // This ensures store has correct value before any timeupdate
      setCurrentTime(finalTime);

      // 2. Seek video to final time
      seek(finalTime);

      // 3. Wait for seek to complete with verification
      performSeek(finalTime, () => {
        draggingPositionRef.current = null;
        setDraggingPosition(null);
        setIsScrubbing(false);
      });
    } else {
      setIsScrubbing(false);
    }
  }, [duration, seek, setIsScrubbing, setCurrentTime, performSeek]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const { handleMouseDown } = useDragHandle('playhead', {
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });

  return (
    <div
      ref={containerRef}
      className="absolute top-0 bottom-0 z-30 pointer-events-none"
      style={{
        left: `${position}%`,
      }}
    >
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 -left-px bottom-0 w-px bg-[#ff4444] cursor-ew-resize pointer-events-auto"
      >
        {/* Top circle handle */}
        <div
          className="absolute -top-1 -left-[5px] w-[11px] h-[14px] bg-[#ff4444] rounded-full border border-[#101114] cursor-ew-resize"
        />
      </div>
    </div>
  );
});
