"use client";

interface HandleMarkerProps {
  /** stem·▽ 채움색 (#ff4444 playhead / #ffee65 trim). */
  color: string;
  /** locked opacity 등 추가 클래스. */
  className?: string;
}

/**
 * 타임라인 핸들 시각(1px stem + 아래 삼각 ▽)을 SVG로 렌더.
 *
 * stem을 `<rect width="1" shapeRendering="crispEdges">`로 그려 grip(삼각) 폭·스케일과
 * 무관하게 **정확히 1px**로 고정한다(div grip 블록이 바를 두껍게 보이게 하던 문제 해소).
 * 부모는 폭 12px 컨테이너여야 함(중앙 x=6에 stem 정렬). pointer-events 없음(시각 전용).
 * playhead/trim이 색만 달리해 공유 → 스크러버 어포던스 통일.
 */
export function HandleMarker({ color, className = "" }: HandleMarkerProps) {
  return (
    <svg className={`absolute inset-0 h-full w-full pointer-events-none ${className}`}>
      {/* stem — 정확히 1px, 렌더 [6,7] → 시각중심 x=6.5 */}
      <rect x="6" y="0" width="1" height="100%" fill={color} shapeRendering="crispEdges" />
      {/* grip — 아래 삼각(▽). apex x=6.5로 stem 중심과 정렬 */}
      <polygon points="1.5,0 11.5,0 6.5,7" fill={color} />
    </svg>
  );
}
