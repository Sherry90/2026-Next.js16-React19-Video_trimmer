"use client";

import { useTrimHandleControl } from "@/features/timeline/hooks/useTrimHandleControl";

interface TrimHandleProps {
  type: "in" | "out";
}

/**
 * in/out 공용 트림 핸들.
 * store 가공/드래그 로직은 useTrimHandleControl이 담당 — 이 컴포넌트는 렌더만.
 */
export function TrimHandle({ type }: TrimHandleProps) {
  const { containerRef, position, isLocked, handleMouseDown } = useTrimHandleControl(type);

  return (
    <div
      ref={containerRef}
      className="absolute top-0 bottom-0 z-20"
      style={{ left: `${position}%` }}
    >
      <div
        onMouseDown={isLocked ? undefined : handleMouseDown}
        className={`absolute top-0 ${type === "in" ? "left-0" : "-left-px"} bottom-0 w-px bg-[#ffee65] ${
          isLocked ? "cursor-not-allowed opacity-50" : "cursor-ew-resize opacity-100"
        }`}
      >
        {/* Top handle grip */}
        <div
          className={`absolute top-0 -left-[3px] w-[7px] h-6 bg-[#ffee65] rounded-b ${
            isLocked ? "cursor-not-allowed" : "cursor-ew-resize"
          }`}
        />
      </div>
    </div>
  );
}
