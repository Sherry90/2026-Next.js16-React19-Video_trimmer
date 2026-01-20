'use client';

import { useCallback, useRef } from 'react';
import type { HandleType } from '@/types/timeline';

interface UseDragHandleOptions {
  onDragStart?: (handleType: HandleType, startX: number) => void;
  onDrag?: (handleType: HandleType, deltaX: number, currentX: number) => void;
  onDragEnd?: (handleType: HandleType) => void;
}

export function useDragHandle(handleType: HandleType, options: UseDragHandleOptions = {}) {
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      isDraggingRef.current = true;
      startXRef.current = e.clientX;

      options.onDragStart?.(handleType, e.clientX);

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;

        const deltaX = moveEvent.clientX - startXRef.current;
        options.onDrag?.(handleType, deltaX, moveEvent.clientX);
      };

      const handleMouseUp = () => {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          options.onDragEnd?.(handleType);

          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [handleType, options]
  );

  return {
    handleMouseDown,
    isDragging: isDraggingRef.current,
  };
}
