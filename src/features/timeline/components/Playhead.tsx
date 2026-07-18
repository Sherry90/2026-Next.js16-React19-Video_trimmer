"use client";

import { memo } from "react";
import { usePlayheadControl } from "@/features/timeline/hooks/usePlayheadControl";

/**
 * 재생 위치 표시 + 드래그 핸들.
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
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 -left-px bottom-0 w-px bg-[#ff4444] cursor-ew-resize pointer-events-auto"
      >
        {/* Top circle handle */}
        <div className="absolute -top-1 -left-[5px] w-[11px] h-[14px] bg-[#ff4444] rounded-full border border-[#101114] cursor-ew-resize" />
      </div>
    </div>
  );
});
