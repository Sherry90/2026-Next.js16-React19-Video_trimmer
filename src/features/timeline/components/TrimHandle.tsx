'use client';

import { useCallback, useRef } from 'react';
import { useStore } from '@/stores/useStore';
import { useVideoDuration, useTimelineActions, usePlayerActions } from '@/stores/selectors';
import { useDragHandle } from '@/features/timeline/hooks/useDragHandle';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';
import { TIMELINE } from '@/constants/appConfig';

interface TrimHandleProps {
  type: 'in' | 'out';
}

/**
 * Unified trim handle component for both in-point and out-point.
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
  const { setCurrentTime } = usePlayerActions();
  const { seek, player } = useVideoPlayerContext();
  const setPoint = type === 'in' ? setInPoint : setOutPoint;

  // Position calculation: 0% for in-point (or 0 if no duration), 100% for out-point
  const position = duration > 0
    ? (point / duration) * 100
    : (type === 'in' ? 0 : 100);

  const startTimeRef = useRef(point);
  const lastSeekTimeRef = useRef(0);

  const handleDragStart = useCallback(() => {
    startTimeRef.current = point;
    lastSeekTimeRef.current = 0;
  }, [point]);

  // Playhead를 경계로 이동 + 실제 비디오 seek.
  //  - in: 드래그 내내 항상 inPoint로 snap → 편집 시작 프레임 실시간 미리보기.
  //  - out: 제약 위반(playhead가 outPoint 뒤=구간 밖)일 때만 outPoint로 당김.
  const snapPlayheadToBoundary = useCallback(() => {
    const { inPoint, outPoint } = useStore.getState().timeline;
    if (type === 'out') {
      const realTime = player?.currentTime?.() ?? useStore.getState().player.currentTime;
      if (realTime <= outPoint) return;
    }
    const boundary = type === 'in' ? inPoint : outPoint;
    setCurrentTime(boundary);
    seek(boundary);
  }, [type, player, seek, setCurrentTime]);

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (isLocked || !containerRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      const deltaTime = (deltaX / containerWidth) * duration;
      const newTime = startTimeRef.current + deltaTime;

      setPoint(newTime);

      // Throttled seek during drag so Playhead follows the boundary in real time
      const now = Date.now();
      if (now - lastSeekTimeRef.current >= TIMELINE.PLAYHEAD_SEEK_THROTTLE_MS) {
        lastSeekTimeRef.current = now;
        snapPlayheadToBoundary();
      }
    },
    [duration, isLocked, setPoint, snapPlayheadToBoundary]
  );

  const { handleMouseDown } = useDragHandle(type === 'in' ? 'inPoint' : 'outPoint', {
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    // 최종 확정 — throttle이 마지막 mousemove를 건너뛰어도 여기서 경계로 snap.
    onDragEnd: snapPlayheadToBoundary,
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
