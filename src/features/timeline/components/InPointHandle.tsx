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
      className="absolute top-0 bottom-0 z-20"
      style={{
        left: `${position}%`,
      }}
    >
      <div
        onMouseDown={isLocked ? undefined : handleMouseDown}
        className={`absolute top-0 left-0 bottom-0 w-px bg-[#ffee65] ${
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
