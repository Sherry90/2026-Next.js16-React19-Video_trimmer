'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useStore } from '@/stores/useStore';
import { useDragHandle } from '@/features/timeline/hooks/useDragHandle';

export function Playhead() {
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTime = useStore((state) => state.player.currentTime);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const setPlayhead = useStore((state) => state.setPlayhead);

  const position = duration > 0 ? (currentTime / duration) * 100 : 0;

  const startTimeRef = useRef(currentTime);

  // Sync playhead with currentTime
  useEffect(() => {
    setPlayhead(currentTime);
  }, [currentTime, setPlayhead]);

  const handleDragStart = useCallback(() => {
    startTimeRef.current = currentTime;
  }, [currentTime]);

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (!containerRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      const deltaTime = (deltaX / containerWidth) * duration;
      const newTime = startTimeRef.current + deltaTime;

      setPlayhead(newTime);
    },
    [duration, setPlayhead]
  );

  const { handleMouseDown } = useDragHandle('playhead', {
    onDragStart: handleDragStart,
    onDrag: handleDrag,
  });

  return (
    <div
      ref={containerRef}
      className="absolute top-0 bottom-0 pointer-events-none"
      style={{
        left: `${position}%`,
        zIndex: 30,
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
