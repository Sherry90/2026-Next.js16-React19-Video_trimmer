'use client';

import { useCallback, useRef, type RefObject } from 'react';
import { useVideoDuration, useTrimPoints, useTrimLocks, useTrimPointActions, usePlayerActions } from '@/stores/hooks';
import { getTimelineSnapshot, getPlayerSnapshot } from '@/stores/snapshot';
import { useVideoPlayerContext } from '@/shared/video-player/VideoPlayerContext';
import { useDragHandle } from './useDragHandle';
import { deltaXToTime, timeToPercent } from '@/features/timeline/utils/timelineCoords';
import { TIMELINE } from '@/constants/appConfig';

export interface TrimHandleControl {
  containerRef: RefObject<HTMLDivElement | null>;
  /** 렌더 위치(퍼센트 0-100). */
  position: number;
  isLocked: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * 트림 핸들(in/out) 드래그 제어 스마트 hook.
 *
 * deltaX→시간 변환으로 경계를 이동하고, throttle로 playhead를 경계에 snap(실시간 미리보기).
 * 라이브 in/out·player currentTime은 snapshot 게터로 읽어 stale-closure를 피한다.
 * 컴포넌트는 position/isLocked/handleMouseDown만 소비.
 */
export function useTrimHandleControl(type: 'in' | 'out'): TrimHandleControl {
  const containerRef = useRef<HTMLDivElement>(null);

  const { inPoint, outPoint } = useTrimPoints();
  const duration = useVideoDuration();
  const { isInPointLocked, isOutPointLocked } = useTrimLocks();
  const { setInPoint, setOutPoint } = useTrimPointActions();
  const { setCurrentTime } = usePlayerActions();
  const { seek, player } = useVideoPlayerContext();

  const point = type === 'in' ? inPoint : outPoint;
  const isLocked = type === 'in' ? isInPointLocked : isOutPointLocked;
  const setPoint = type === 'in' ? setInPoint : setOutPoint;

  const position = duration > 0 ? timeToPercent(point, duration) : type === 'in' ? 0 : 100;

  const startTimeRef = useRef(point);
  const lastSeekTimeRef = useRef(0);

  const handleDragStart = useCallback(() => {
    startTimeRef.current = point;
    lastSeekTimeRef.current = 0;
  }, [point]);

  // Playhead를 경계로 이동 + 실제 seek.
  //  - in: 드래그 내내 inPoint로 snap → 시작 프레임 실시간 미리보기.
  //  - out: 제약 위반(playhead가 outPoint 뒤=구간 밖)일 때만 outPoint로 당김.
  const snapPlayheadToBoundary = useCallback(() => {
    const { inPoint: liveIn, outPoint: liveOut } = getTimelineSnapshot();
    if (type === 'out') {
      const realTime = player?.currentTime?.() ?? getPlayerSnapshot().currentTime;
      if (realTime <= liveOut) return;
    }
    const boundary = type === 'in' ? liveIn : liveOut;
    setCurrentTime(boundary);
    seek(boundary);
  }, [type, player, seek, setCurrentTime]);

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (isLocked || !containerRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      const newTime = startTimeRef.current + deltaXToTime(deltaX, containerWidth, duration);
      setPoint(newTime);

      // 드래그 중 throttle seek → Playhead가 경계를 실시간 추종.
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
    // 최종 확정 — throttle이 마지막 mousemove를 건너뛰어도 경계로 snap.
    onDragEnd: snapPlayheadToBoundary,
  });

  return { containerRef, position, isLocked, handleMouseDown };
}
