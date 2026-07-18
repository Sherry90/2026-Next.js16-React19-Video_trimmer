"use client";

import { memo } from "react";
import { usePlayheadControl } from "@/features/timeline/hooks/usePlayheadControl";

/**
 * 재생 위치 표시 + 드래그 핸들.
 *
 * 세로선은 룰러+트랙을 관통(시각 전용, pointer-events-none)하고,
 * grab은 상단 룰러 밴드의 grip(▽)에만 있다 — trim 핸들(트랙 본체)과 Y존을 분리해
 * 같은 시간 위치에서도 서로 겹쳐 잡히지 않게 한다.
 * store 가공/드래그 로직은 usePlayheadControl이 담당 — 이 컴포넌트는 렌더만.
 */
export const Playhead = memo(function Playhead() {
  const { containerRef, position, handleMouseDown } = usePlayheadControl();

  return (
    <div
      ref={containerRef}
      className="absolute top-0 bottom-0 z-30 pointer-events-none"
      style={{ left: `${position}%` }}
    >
      {/* 세로선 — 룰러+트랙 관통, 시각 전용 */}
      <div className="absolute top-0 -left-px bottom-0 w-px bg-[#ff4444]" />

      {/* grip(▽) — 룰러 밴드 상단, 드래그 전용 */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 -left-[7px] w-[14px] h-[16px] flex justify-center cursor-ew-resize pointer-events-auto"
      >
        <div className="h-0 w-0 border-l-[6px] border-r-[6px] border-t-[9px] border-l-transparent border-r-transparent border-t-[#ff4444]" />
      </div>
    </div>
  );
});
