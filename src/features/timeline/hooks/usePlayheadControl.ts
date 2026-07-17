'use client';

import { useCallback, useMemo, useRef, useState, useEffect, type RefObject } from 'react';
import { usePlayerCurrentTime, useVideoDuration, useTrimPoints, usePlayerActions } from '@/stores/hooks';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';
import { useDragHandle } from './useDragHandle';
import { usePlayheadSeek } from './usePlayheadSeek';
import { timeToPercent, percentToTime, clampPercentToTrim } from '@/features/timeline/utils/timelineCoords';
import { TIMELINE } from '@/constants/appConfig';

export interface PlayheadControl {
  /** 드래그 컨테이너 ref. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** 렌더 위치(퍼센트 0-100). */
  position: number;
  /** 핸들 mousedown 핸들러. */
  handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Playhead 드래그 제어 스마트 hook — 컴포넌트에 흩어져 있던 store 가공 로직을 흡수.
 *
 * 드래그는 퍼센트 좌표로 다루고(store currentTime↔퍼센트 변환), 트림 구간으로 clamp,
 * throttle로 실시간 seek, scrubbing 플래그로 timeupdate race 방지, 드래그 끝엔
 * seek 완료(seeked 검증) 후 scrubbing 해제. 컴포넌트는 position/handleMouseDown만 소비.
 */
export function usePlayheadControl(): PlayheadControl {
  const containerRef = useRef<HTMLDivElement>(null);

  // 드래그 중 위치는 퍼센트(0-100)로 추적.
  const [draggingPosition, setDraggingPosition] = useState<number | null>(null);
  const draggingPositionRef = useRef<number | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const lastSeekTimeRef = useRef<number>(0);
  const seekThrottleDelay = TIMELINE.PLAYHEAD_SEEK_THROTTLE_MS;

  const currentTime = usePlayerCurrentTime();
  const duration = useVideoDuration();
  const { inPoint, outPoint } = useTrimPoints();
  const { setCurrentTime } = usePlayerActions();
  const { seek, setIsScrubbing, player } = useVideoPlayerContext();
  const { performSeek } = usePlayheadSeek(player);

  const position = useMemo(() => {
    if (draggingPosition !== null) return draggingPosition;
    return timeToPercent(currentTime, duration);
  }, [draggingPosition, currentTime, duration]);

  const startPositionRef = useRef(position);

  const handleDragStart = useCallback(() => {
    const startPosition = timeToPercent(currentTime, duration);
    startPositionRef.current = startPosition;
    isDraggingRef.current = true;
    draggingPositionRef.current = startPosition;
    setDraggingPosition(startPosition);
    setIsScrubbing(true);
    lastSeekTimeRef.current = 0;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [currentTime, duration, setIsScrubbing]);

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (!containerRef.current || !isDraggingRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      if (containerWidth === 0) return;

      const deltaPercent = (deltaX / containerWidth) * 100;
      const newPosition = clampPercentToTrim(
        startPositionRef.current + deltaPercent,
        inPoint,
        outPoint,
        duration
      );

      draggingPositionRef.current = newPosition;
      setDraggingPosition(newPosition);

      // 드래그 중 throttle 실시간 seek.
      const now = Date.now();
      if (now - lastSeekTimeRef.current >= seekThrottleDelay) {
        lastSeekTimeRef.current = now;
        const seekTime = percentToTime(newPosition, duration);
        setCurrentTime(seekTime); // UI 반응성 위해 store 먼저
        seek(seekTime);
      }
    },
    [duration, inPoint, outPoint, seek, setCurrentTime, seekThrottleDelay]
  );

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    const finalPosition = draggingPositionRef.current;
    if (finalPosition !== null) {
      const finalTime = percentToTime(finalPosition, duration);
      // timeupdate보다 앞서도록 store 먼저 갱신 후 seek.
      setCurrentTime(finalTime);
      seek(finalTime);
      performSeek(finalTime, () => {
        draggingPositionRef.current = null;
        setDraggingPosition(null);
        setIsScrubbing(false);
      });
    } else {
      setIsScrubbing(false);
    }
  }, [duration, seek, setIsScrubbing, setCurrentTime, performSeek]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const { handleMouseDown } = useDragHandle('playhead', {
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });

  return { containerRef, position, handleMouseDown };
}
