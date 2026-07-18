"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useVideoDuration, useTrimPoints, usePlayerActions } from "@/stores/hooks";
import { useVideoPlayerContext } from "@/shared/video-player/VideoPlayerContext";
import { usePlayheadSeek } from "@/shared/video-player/usePlayheadSeek";
import {
  clientXToPercent,
  clampPercentToTrim,
  percentToTime,
} from "@/features/timeline/utils/timelineCoords";
import { TIMELINE } from "@/constants/appConfig";

export interface RulerScrub {
  /** 룰러 mousedown 핸들러 — 클릭/드래그 절대 seek. */
  handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * 룰러 스트립 클릭/스크럽 제어 hook.
 *
 * playhead 드래그(delta 기반)와 달리 룰러는 절대 위치(clientX→percent) seek.
 * seek 경로는 usePlayheadControl과 동일(setIsScrubbing으로 timeupdate race 방지,
 * throttle 실시간 seek, mouseup 시 performSeek 검증 후 scrubbing 해제).
 * 클램프는 기존 playhead 불변식과 일관되게 트림 구간[in,out]으로 제한.
 */
export function useRulerScrub(rulerRef: RefObject<HTMLDivElement | null>): RulerScrub {
  const duration = useVideoDuration();
  const { inPoint, outPoint } = useTrimPoints();
  const { setCurrentTime } = usePlayerActions();
  const { seek, setIsScrubbing, player } = useVideoPlayerContext();
  const { performSeek } = usePlayheadSeek(player);

  const lastSeekTimeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // clientX → 트림 클램프된 시간(초).
  const clientXToTime = useCallback(
    (clientX: number) => {
      const rect = rulerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const percent = clampPercentToTrim(
        clientXToPercent(clientX, rect),
        inPoint,
        outPoint,
        duration,
      );
      return percentToTime(percent, duration);
    },
    [rulerRef, inPoint, outPoint, duration],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (duration <= 0) return;
      e.preventDefault();

      setIsScrubbing(true);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
      lastSeekTimeRef.current = 0;

      const seekTo = (clientX: number) => {
        const time = clientXToTime(clientX);
        if (time === null) return;
        lastTimeRef.current = time;
        setCurrentTime(time); // UI 반응성 위해 store 먼저
        seek(time);
      };

      // mousedown 즉시 seek.
      seekTo(e.clientX);
      lastSeekTimeRef.current = Date.now();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const now = Date.now();
        if (now - lastSeekTimeRef.current < TIMELINE.PLAYHEAD_SEEK_THROTTLE_MS) return;
        lastSeekTimeRef.current = now;
        seekTo(moveEvent.clientX);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        // 최종 위치 확정 후 seek 검증.
        const finalTime = clientXToTime(upEvent.clientX) ?? lastTimeRef.current;
        setCurrentTime(finalTime);
        seek(finalTime);
        performSeek(finalTime, () => setIsScrubbing(false));
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [duration, clientXToTime, seek, setCurrentTime, setIsScrubbing, performSeek],
  );

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  return { handleMouseDown };
}
