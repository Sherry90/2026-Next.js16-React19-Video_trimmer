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
      className="absolute top-0 bottom-0 z-10"
      style={{ left: `${position}%` }}
    >
      {/* 핸들 */}
      <div
        onMouseDown={isLocked ? undefined : handleMouseDown}
        className={`
          absolute top-0 bottom-0 w-1 bg-green-500
          ${isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-ew-resize hover:bg-green-600'}
        `}
      >
        {/* 상단 그립 */}
        <div className="absolute -top-1 -left-2 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-gray-900" />

        {/* 라벨 */}
        <div className="absolute -top-6 -left-6 px-2 py-1 text-xs font-medium text-white bg-green-500 rounded whitespace-nowrap">
          IN
        </div>
      </div>
    </div>
  );
}
