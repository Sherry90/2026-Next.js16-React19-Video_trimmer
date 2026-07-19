"use client";

import { memo } from "react";
import { usePlayheadControl } from "@/features/timeline/hooks/usePlayheadControl";
import { HandleMarker } from "./HandleMarker";

/**
 * 재생 위치 표시 + 드래그 핸들.
 *
 * 시각(1px stem + ▽)은 SVG(HandleMarker)가 담당해 룰러+트랙을 관통(pointer-events-none),
 * grab은 상단 룰러 밴드의 투명 grip hit에만 둔다 — trim 핸들(트랙 본체)과 Y존을 분리해
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
      {/* 시각 — 1px stem + ▽ (SVG). 폭 12px 컨테이너로 중앙 정렬 */}
      <div className="absolute top-0 -left-[6px] bottom-0 w-[12px] pointer-events-none">
        <HandleMarker color="#ff4444" />
      </div>

      {/* grip 드래그 hit — 룰러 밴드 상단, 투명 */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute top-0 -left-[7px] w-[14px] h-[16px] cursor-ew-resize pointer-events-auto"
      />
    </div>
  );
});
