'use client';

import { useCallback, useRef, useState } from 'react';
import { useStore } from '@/stores/useStore';
import { useDragHandle } from '@/features/timeline/hooks/useDragHandle';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';

export function Playhead() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingTime, setDraggingTime] = useState<number | null>(null);
  const lastSeekTimeRef = useRef<number>(0);

  const currentTime = useStore((state) => state.player.currentTime);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);

  const { seek, setIsScrubbing } = useVideoPlayerContext();

  // Use draggingTime if available (during drag), otherwise source of truth from store
  const displayTime = draggingTime ?? currentTime;
  const position = duration > 0 ? (displayTime / duration) * 100 : 0;

  const startTimeRef = useRef(currentTime);

  const handleDragStart = useCallback(() => {
    startTimeRef.current = currentTime;
    setDraggingTime(currentTime);
    setIsScrubbing(true);
  }, [currentTime, setIsScrubbing]);

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      const deltaTime = (deltaX / containerWidth) * duration;
      let newTime = startTimeRef.current + deltaTime;

      // Constrain to in/out points
      newTime = Math.max(inPoint, Math.min(newTime, outPoint));

      // Update local state immediately for smooth UI
      setDraggingTime(newTime);

      // Throttle video seeking to prevent lag
      const now = Date.now();
      if (now - lastSeekTimeRef.current > 50) { // Update video every ~50ms
        seek(newTime);
        lastSeekTimeRef.current = now;
      }
    },
    [duration, inPoint, outPoint, seek]
  );

  const handleDragEnd = useCallback(() => {
    // Ensure final position is synced
    if (draggingTime !== null) {
      seek(draggingTime);
      // We must allow the final update to propagate
      // But we set isScrubbing false first? No, if we set false, then the seek's timeupdate will catch it.
      // Wait, seek() is async roughly.
      // Better: setIsScrubbing(false) then seek?
      // If we seek first, timeupdate might fire while isScrubbing is true.
      // Actually, we want the FINAL update.
      setIsScrubbing(false);
      // Force store update for final position if needed, or rely on next timeupdate
      // seek() triggers timeupdate.
    } else {
      setIsScrubbing(false);
    }
    setDraggingTime(null);
  }, [draggingTime, seek, setIsScrubbing]);

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
