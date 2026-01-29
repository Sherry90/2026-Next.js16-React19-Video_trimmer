'use client';

import { useCallback, useRef } from 'react';
import { useStore } from '@/stores/useStore';
import { useVideoDuration, useTimelineActions } from '@/stores/selectors';
import { useDragHandle } from '@/features/timeline/hooks/useDragHandle';

interface TrimHandleProps {
  type: 'in' | 'out';
}

/**
 * Unified trim handle component for both in-point and out-point
 * Eliminates 85% duplication between InPointHandle and OutPointHandle
 */
export function TrimHandle({ type }: TrimHandleProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Select appropriate state based on type
  const point = useStore((state) =>
    type === 'in' ? state.timeline.inPoint : state.timeline.outPoint
  );
  const duration = useVideoDuration();
  const isLocked = useStore((state) =>
    type === 'in' ? state.timeline.isInPointLocked : state.timeline.isOutPointLocked
  );
  const { setInPoint, setOutPoint } = useTimelineActions();
  const setPoint = type === 'in' ? setInPoint : setOutPoint;

  // Position calculation: 0% for in-point (or 0 if no duration), 100% for out-point
  const position = duration > 0
    ? (point / duration) * 100
    : (type === 'in' ? 0 : 100);

  const startTimeRef = useRef(point);

  const handleDragStart = useCallback(() => {
    startTimeRef.current = point;
  }, [point]);

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (isLocked || !containerRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      const deltaTime = (deltaX / containerWidth) * duration;
      const newTime = startTimeRef.current + deltaTime;

      setPoint(newTime);
    },
    [duration, isLocked, setPoint]
  );

  const { handleMouseDown } = useDragHandle(type === 'in' ? 'inPoint' : 'outPoint', {
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
        className={`absolute top-0 ${type === 'in' ? 'left-0' : '-left-px'} bottom-0 w-px bg-[#ffee65] ${
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
