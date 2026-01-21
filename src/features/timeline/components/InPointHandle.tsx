'use client';

import { useCallback, useRef } from 'react';
import { useStore } from '@/stores/useStore';
import { useDragHandle } from '@/features/timeline/hooks/useDragHandle';

export function InPointHandle() {
  const containerRef = useRef<HTMLDivElement>(null);

  const inPoint = useStore((state) => state.timeline.inPoint);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const isLocked = useStore((state) => state.timeline.isInPointLocked);
  const setInPoint = useStore((state) => state.setInPoint);

  const position = duration > 0 ? (inPoint / duration) * 100 : 0;

  const startTimeRef = useRef(inPoint);

  const handleDragStart = useCallback(() => {
    startTimeRef.current = inPoint;
  }, [inPoint]);

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (isLocked || !containerRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      const deltaTime = (deltaX / containerWidth) * duration;
      const newTime = startTimeRef.current + deltaTime;

      setInPoint(newTime);
    },
    [duration, isLocked, setInPoint]
  );

  const { handleMouseDown } = useDragHandle('inPoint', {
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
          left: 0,
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
