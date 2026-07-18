"use client";

import { useCallback, useRef, type RefObject } from "react";
import {
  useVideoDuration,
  useTrimPoints,
  useTrimLocks,
  useTrimPointActions,
  usePlayerActions,
} from "@/stores/hooks";
import { getTimelineSnapshot, getPlayerSnapshot } from "@/stores/snapshot";
import { useVideoPlayerContext } from "@/shared/video-player/VideoPlayerContext";
import { useDragHandle } from "./useDragHandle";
import { deltaXToTime, timeToPercent } from "@/features/timeline/utils/timelineCoords";
import { TIMELINE } from "@/constants/appConfig";

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
export function useTrimHandleControl(type: "in" | "out"): TrimHandleControl {
  const containerRef = useRef<HTMLDivElement>(null);

  const { inPoint, outPoint } = useTrimPoints();
  const duration = useVideoDuration();
  const { isInPointLocked, isOutPointLocked } = useTrimLocks();
  const { setInPoint, setOutPoint, setDraggingBoundary } = useTrimPointActions();
  const { setCurrentTime } = usePlayerActions();
  const { seek, player } = useVideoPlayerContext();

  const point = type === "in" ? inPoint : outPoint;
  const isLocked = type === "in" ? isInPointLocked : isOutPointLocked;
  const setPoint = type === "in" ? setInPoint : setOutPoint;

  const position = duration > 0 ? timeToPercent(point, duration) : type === "in" ? 0 : 100;

  const startTimeRef = useRef(point);
  const lastSeekTimeRef = useRef(0);

  const handleDragStart = useCallback(() => {
    startTimeRef.current = point;
    lastSeekTimeRef.current = 0;
    // in-drag 동안 playhead는 inPoint를 직접 렌더(동일 store 값 → lockstep sync).
    setDraggingBoundary(type);
  }, [point, type, setDraggingBoundary]);

  // Playhead를 경계로 이동 + 실제 seek.
  //  - in: 드래그 중 playhead 렌더는 inPoint(draggingBoundary) 경로가 담당 → 여기선 throttle seek만.
  //        (currentTime store 갱신은 드래그 종료 시 1회 커밋 → per-frame 렌더 부하 제거.)
  //  - out: 제약 위반(playhead가 outPoint 뒤=구간 밖)일 때만 currentTime/seek로 outPoint로 당김.
  // doSeek=false면 store 상태만, true면 실제 비디오 seek(네트워크 바운드)까지 수행.
  const snapPlayheadToBoundary = useCallback(
    (doSeek: boolean) => {
      const { inPoint: liveIn, outPoint: liveOut } = getTimelineSnapshot();
      if (type === "out") {
        const realTime = player?.currentTime?.() ?? getPlayerSnapshot().currentTime;
        if (realTime <= liveOut) return;
        setCurrentTime(liveOut);
        if (doSeek) seek(liveOut);
        return;
      }
      // in: playhead 렌더는 inPoint 경로. 여기선 throttle seek만(비디오 프레임 프리뷰).
      if (doSeek) seek(liveIn);
    },
    [type, player, seek, setCurrentTime],
  );

  const handleDrag = useCallback(
    (_handleType: string, deltaX: number) => {
      if (isLocked || !containerRef.current) return;

      const containerWidth = containerRef.current.parentElement?.clientWidth ?? 0;
      const newTime = startTimeRef.current + deltaXToTime(deltaX, containerWidth, duration);
      setPoint(newTime);

      // seek(비디오 프레임)만 throttle. playhead UI 추종은 inPoint 갱신으로 매 프레임 즉시.
      const now = Date.now();
      const shouldSeek = now - lastSeekTimeRef.current >= TIMELINE.PLAYHEAD_SEEK_THROTTLE_MS;
      if (shouldSeek) lastSeekTimeRef.current = now;
      snapPlayheadToBoundary(shouldSeek);
    },
    [duration, isLocked, setPoint, snapPlayheadToBoundary],
  );

  const handleDragEnd = useCallback(() => {
    // 최종 확정 — in은 currentTime 커밋(재생 재개 위치) + seek, out은 조건부 snap. 이후 플래그 해제.
    const { inPoint: liveIn } = getTimelineSnapshot();
    if (type === "in") {
      setCurrentTime(liveIn);
      seek(liveIn);
    } else {
      snapPlayheadToBoundary(true);
    }
    setDraggingBoundary(null);
  }, [type, seek, setCurrentTime, snapPlayheadToBoundary, setDraggingBoundary]);

  const { handleMouseDown } = useDragHandle(type === "in" ? "inPoint" : "outPoint", {
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });

  return { containerRef, position, isLocked, handleMouseDown };
}
