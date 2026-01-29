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
      className="absolute top-0 bottom-0 z-20"
      style={{
        left: `${position}%`,
      }}
    >
      <div
        onMouseDown={isLocked ? undefined : handleMouseDown}
        className={`absolute top-0 -left-px bottom-0 w-px bg-[#ffee65] ${
          isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-ew-resize opacity-100'
        }`}
      >
        {/* Top handle grip */}
        <div
          className={`absolute top-0 -left-[3px] w-[7px] h-6 bg-[#ffee65] rounded-b ${
            isLocked ? 'cursor-not-allowed' : 'cursor-ew-resize'
          }`}
        />
      </div>
    </div>
  );
}
