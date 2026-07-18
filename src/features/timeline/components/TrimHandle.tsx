"use client";

import { useTrimHandleControl } from "@/features/timeline/hooks/useTrimHandleControl";

interface TrimHandleProps {
  type: "in" | "out";
}

/**
 * in/out 공용 트림 핸들.
 *
 * 잡기 쉽도록 경계선 중심으로 넓은 투명 hit 영역(12px, 전체 높이)을 두고,
 * 그 안에 1px 시각선 + 상단 grip을 렌더한다. grab은 트랙 본체에만 있어
 * 룰러의 playhead grip과 Y존이 분리된다(같은 시간 위치에서도 안 겹침).
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
      {/* 넓은 투명 hit 영역 — 경계선 중심 12px, 전체 높이 */}
      <div
        onMouseDown={isLocked ? undefined : handleMouseDown}
        className={`absolute top-0 -left-[6px] bottom-0 w-[12px] flex justify-center ${
          isLocked ? "cursor-not-allowed" : "cursor-ew-resize"
        }`}
      >
        {/* 시각 1px 선 */}
        <div className={`w-px h-full bg-[#ffee65] ${isLocked ? "opacity-50" : "opacity-100"}`} />
        {/* 상단 grip */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-[7px] h-6 bg-[#ffee65] rounded-b ${
            isLocked ? "opacity-50" : ""
          }`}
        />
      </div>
    </div>
  );
}
