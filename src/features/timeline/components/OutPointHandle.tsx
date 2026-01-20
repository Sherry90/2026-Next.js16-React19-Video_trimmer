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
      className="absolute top-0 bottom-0 z-10"
      style={{ left: `${position}%` }}
    >
      {/* 핸들 */}
      <div
        onMouseDown={isLocked ? undefined : handleMouseDown}
        className={`
          absolute top-0 bottom-0 w-1 bg-red-500
          ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-ew-resize hover:bg-red-600'}
        `}
      >
        {/* 상단 그립 */}
        <div className="absolute -top-1 -left-2 w-5 h-5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900" />

        {/* 라벨 */}
        <div className="absolute -top-6 -left-6 px-2 py-1 text-xs font-medium text-white bg-red-500 rounded whitespace-nowrap">
          OUT
        </div>
      </div>
    </div>
  );
}
