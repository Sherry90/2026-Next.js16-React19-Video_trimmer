'use client';

import { useCallback, useRef } from 'react';
import { useStore } from '@/stores/useStore';
import { useDragHandle } from '@/features/timeline/hooks/useDragHandle';

export function Playhead() {
  const containerRef = useRef<HTMLDivElement>(null);

  const playhead = useStore((state) => state.timeline.playhead);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const setPlayhead = useStore((state) => state.setPlayhead);

  const position = duration > 0 ? (playhead / duration) * 100 : 0;

  const startTimeRef = useRef(playhead);

  const handleDragStart = useCallback(() => {
    startTimeRef.current = playhead;
  }, [playhead]);

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
      className="absolute top-0 bottom-0 z-20 pointer-events-none"
      style={{ left: `${position}%` }}
    >
      {/* 플레이헤드 라인 */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 bottom-0 w-0.5 bg-blue-500 pointer-events-auto cursor-ew-resize"
      >
        {/* 상단 헤드 */}
        <div className="absolute -top-2 -left-3 w-6 h-4 bg-blue-500 rounded-t pointer-events-auto">
          <svg
            className="w-full h-full text-white"
            viewBox="0 0 24 16"
            fill="currentColor"
          >
            <path d="M12 16L0 0h24z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
