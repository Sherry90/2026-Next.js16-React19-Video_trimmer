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

  // Position is tracked as PERCENTAGE (0-100), not time, during drag.
  const [draggingPosition, setDraggingPosition] = useState<number | null>(null);
  const draggingPositionRef = useRef<number | null>(null); // stable closure for handlers
  const isDraggingRef = useRef<boolean>(false);

  const lastSeekTimeRef = useRef<number>(0);
  const seekThrottleDelay = TIMELINE.PLAYHEAD_SEEK_THROTTLE_MS;

  const currentTime = useStore((state) => state.player.currentTime);
  const duration = useVideoDuration();
  const { inPoint, outPoint } = useTrimPoints();

  const { setCurrentTime } = usePlayerActions();
  const { seek, setIsScrubbing, player } = useVideoPlayerContext();
  const { performSeek } = usePlayheadSeek(player);

  // Memoized position in percentage coordinates (not time).
  const position = useMemo(() => {
    if (draggingPosition !== null) {
      return draggingPosition;
    }
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  }, [draggingPosition, currentTime, duration]);

  const startPositionRef = useRef(position);

  const handleDragStart = useCallback(() => {
    const startPosition = duration > 0 ? (currentTime / duration) * 100 : 0;
    startPositionRef.current = startPosition;
    isDraggingRef.current = true;

    draggingPositionRef.current = startPosition;
    setDraggingPosition(startPosition);
    setIsScrubbing(true);

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

      // Work in percentage coordinates, not time.
      const deltaPercent = (deltaX / containerWidth) * 100;
      let newPosition = startPositionRef.current + deltaPercent;

      // Constrain to in/out points (as percentages)
      const inPointPercent = duration > 0 ? (inPoint / duration) * 100 : 0;
      const outPointPercent = duration > 0 ? (outPoint / duration) * 100 : 100;
      newPosition = Math.max(inPointPercent, Math.min(newPosition, outPointPercent));

      draggingPositionRef.current = newPosition;
      setDraggingPosition(newPosition);

      // Throttled real-time seek during drag
      const now = Date.now();
      if (now - lastSeekTimeRef.current >= seekThrottleDelay) {
        lastSeekTimeRef.current = now;
        const seekTime = (newPosition / 100) * duration;
        setCurrentTime(seekTime); // store first for UI responsiveness
        seek(seekTime);
      }
    },
    [duration, inPoint, outPoint, seek, setCurrentTime, seekThrottleDelay]
  );

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Latest position via ref (stable closure)
    const finalPosition = draggingPositionRef.current;

    if (finalPosition !== null) {
      // Convert percentage → time once, at drag end
      const finalTime = (finalPosition / 100) * duration;

      // Update store synchronously before seek so it's correct ahead of any timeupdate
      setCurrentTime(finalTime);
      seek(finalTime);

      // Wait for seek to complete before clearing drag state
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
