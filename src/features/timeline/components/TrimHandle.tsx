"use client";

import { useTrimHandleControl } from "@/features/timeline/hooks/useTrimHandleControl";
import { HandleMarker } from "./HandleMarker";

interface TrimHandleProps {
  type: "in" | "out";
}

/**
 * in/out 공용 트림 핸들.
 *
 * 잡기 쉽도록 경계선 중심 넓은 투명 hit 영역(12px, 전체 높이)을 두고, 시각(1px stem + ▽)은
 * SVG(HandleMarker)가 담당한다 — stem 폭이 grip과 무관하게 1px로 고정돼 "바가 두껍다"는
 * 인상이 사라진다. grab은 트랙 본체에만 있어 룰러의 playhead grip과 Y존이 분리된다.
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
      {/* 넓은 투명 hit 영역(12px, 전체 높이) 안에 SVG 시각 */}
      <div
        onMouseDown={isLocked ? undefined : handleMouseDown}
        className={`absolute top-0 -left-[6px] bottom-0 w-[12px] ${
          isLocked ? "cursor-not-allowed" : "cursor-ew-resize"
        }`}
      >
        <HandleMarker color="#ffee65" className={isLocked ? "opacity-50" : ""} />
      </div>
    </div>
  );
}
