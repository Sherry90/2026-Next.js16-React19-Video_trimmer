'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '@/stores/useStore';
import { useDragHandle } from '@/features/timeline/hooks/useDragHandle';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';

export function Playhead() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Store position as PERCENTAGE (0-100), not time!
  const [draggingPosition, setDraggingPosition] = useState<number | null>(null);
  const draggingPositionRef = useRef<number | null>(null); // For stable closure
  const isDraggingRef = useRef<boolean>(false);
  const dragEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track final seek target to verify seeked event
  const finalSeekTargetRef = useRef<number | null>(null);

  const currentTime = useStore((state) => state.player.currentTime);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);

  const setCurrentTime = useStore((state) => state.setCurrentTime);
  const { seek, setIsScrubbing, player } = useVideoPlayerContext();

  // UI works in COORDINATES, not time
  const position = draggingPosition !== null
    ? draggingPosition
    : (duration > 0 ? (currentTime / duration) * 100 : 0);

  const startPositionRef = useRef(position);

  const handleDragStart = useCallback(() => {
    // Capture position at drag start
    const startPosition = duration > 0 ? (currentTime / duration) * 100 : 0;
    startPositionRef.current = startPosition;
    isDraggingRef.current = true;

    draggingPositionRef.current = startPosition;
    setDraggingPosition(startPosition);
    setIsScrubbing(true);

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

      // NO VIDEO SEEK DURING DRAG
      // This prevents multiple pending seeks from causing race conditions
    },
    [duration, inPoint, outPoint]
  );

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;

    // Restore cursor immediately
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Clear any previous timeout
    if (dragEndTimeoutRef.current) {
      clearTimeout(dragEndTimeoutRef.current);
      dragEndTimeoutRef.current = null;
    }

    // Use ref to get latest dragging position (stable closure)
    const finalPosition = draggingPositionRef.current;

    if (finalPosition !== null) {
      // Convert position → time ONCE at drag end
      const finalTime = (finalPosition / 100) * duration;

      // Store target for verification
      finalSeekTargetRef.current = finalTime;

      // 1. Update store SYNCHRONOUSLY before seek
      // This ensures store has correct value before any timeupdate
      setCurrentTime(finalTime);

      // 2. Seek video to final time
      seek(finalTime);

      // 3. Wait for CORRECT seek to complete
      // Verify it's the right seeked event, not a stale one
      if (player) {
        const cleanup = () => {
          draggingPositionRef.current = null;
          setDraggingPosition(null);
          setIsScrubbing(false);
          finalSeekTargetRef.current = null;
          if (dragEndTimeoutRef.current) {
            clearTimeout(dragEndTimeoutRef.current);
            dragEndTimeoutRef.current = null;
          }
        };

        const handleSeeked = () => {
          // Verify this is the correct seek
          const currentTime = player.currentTime?.();
          if (currentTime !== undefined && finalSeekTargetRef.current !== null) {
            const diff = Math.abs(currentTime - finalSeekTargetRef.current);

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
        dragEndTimeoutRef.current = setTimeout(() => {
          player.off('seeked', handleSeeked);
          cleanup();
        }, 1000);
      } else {
        // No player - just use timeout
        dragEndTimeoutRef.current = setTimeout(() => {
          draggingPositionRef.current = null;
          setDraggingPosition(null);
          setIsScrubbing(false);
        }, 500);
      }
    } else {
      setIsScrubbing(false);
    }
  }, [duration, seek, setIsScrubbing, setCurrentTime, player]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dragEndTimeoutRef.current) {
        clearTimeout(dragEndTimeoutRef.current);
      }
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
        className="absolute top-0 -left-px bottom-0 w-[2px] bg-[#2962ff] cursor-ew-resize pointer-events-auto"
      >
        {/* Top circle handle */}
        <div
          className="absolute -top-1 -left-[5px] w-3 h-3 bg-[#2962ff] rounded-full border-2 border-[#101114] cursor-ew-resize"
        />
      </div>
    </div>
  );
}
