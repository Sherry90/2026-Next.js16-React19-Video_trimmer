'use client';

import { useCallback, useRef } from 'react';
import { useStore } from '@/stores/useStore';
import { useDragHandle } from '@/features/timeline/hooks/useDragHandle';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';

export function Playhead() {
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTime = useStore((state) => state.player.currentTime);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);

  const { seek } = useVideoPlayerContext();

  const position = duration > 0 ? (currentTime / duration) * 100 : 0;

  const startTimeRef = useRef(currentTime);

  const handleDragStart = useCallback(() => {
    startTimeRef.current = currentTime;
  }, [currentTime]);

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      const deltaTime = (deltaX / containerWidth) * duration;
      let newTime = startTimeRef.current + deltaTime;

      // Constrain to in/out points
      newTime = Math.max(inPoint, Math.min(newTime, outPoint));

      seek(newTime);
    },
    [duration, inPoint, outPoint, seek]
  );

  const { handleMouseDown } = useDragHandle('playhead', {
    onDragStart: handleDragStart,
    onDrag: handleDrag,
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
        style={{
          position: 'absolute',
          top: 0,
          left: '-1px',
          bottom: 0,
          width: '2px',
          backgroundColor: '#2962ff',
          cursor: 'ew-resize',
          pointerEvents: 'auto',
        }}
      >
        {/* Top circle handle */}
        <div
          style={{
            position: 'absolute',
            top: '-4px',
            left: '-5px',
            width: '12px',
            height: '12px',
            backgroundColor: '#2962ff',
            borderRadius: '50%',
            border: '2px solid #101114',
            cursor: 'ew-resize',
          }}
        />
      </div>
    </div>
  );
}
