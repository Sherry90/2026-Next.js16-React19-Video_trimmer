'use client';

import { useCallback, useRef } from 'react';
import { useStore } from '@/stores/useStore';
import { useDragHandle } from '@/features/timeline/hooks/useDragHandle';

export function OutPointHandle() {
  const containerRef = useRef<HTMLDivElement>(null);

  const outPoint = useStore((state) => state.timeline.outPoint);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const isLocked = useStore((state) => state.timeline.isOutPointLocked);
  const setOutPoint = useStore((state) => state.setOutPoint);

  const position = duration > 0 ? (outPoint / duration) * 100 : 100;

  const startTimeRef = useRef(outPoint);

  const handleDragStart = useCallback(() => {
    startTimeRef.current = outPoint;
  }, [outPoint]);

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (isLocked || !containerRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      const deltaTime = (deltaX / containerWidth) * duration;
      const newTime = startTimeRef.current + deltaTime;

      setOutPoint(newTime);
    },
    [duration, isLocked, setOutPoint]
  );

  const { handleMouseDown } = useDragHandle('outPoint', {
    onDragStart: handleDragStart,
    onDrag: handleDrag,
  });

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${position}%`,
        zIndex: 20,
      }}
    >
      <div
        onMouseDown={isLocked ? undefined : handleMouseDown}
        style={{
          position: 'absolute',
          top: 0,
          left: '-4px',
          bottom: 0,
          width: '4px',
          backgroundColor: '#ffee65',
          cursor: isLocked ? 'not-allowed' : 'ew-resize',
          opacity: isLocked ? 0.5 : 1,
        }}
      >
        {/* Top handle grip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '-4px',
            width: '12px',
            height: '24px',
            backgroundColor: '#ffee65',
            borderRadius: '0 0 4px 4px',
            cursor: isLocked ? 'not-allowed' : 'ew-resize',
          }}
        />
      </div>
    </div>
  );
}
