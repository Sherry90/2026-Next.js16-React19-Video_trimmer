/**
 * 타임라인 휠 줌 계산 유틸 (순수 함수 — DOM 읽기는 인자로 받은 값만 사용).
 *
 * 커서 위치를 고정점으로 줌 in/out 하기 위한 앵커 계산·scrollLeft 보정.
 * useTimelineZoom 훅에서 사용(리스너/레이아웃 이펙트는 훅이 소유).
 */

export interface ZoomAnchor {
  /** 줌 직전 커서가 가리키던 content 내 위치 비율 (0..1). */
  ratio: number;
  /** viewport 좌측 기준 커서 x (px). */
  cursorX: number;
}

/** 휠 델타 → 다음 줌 값(클램프는 store setZoom 내부 constrainZoom이 담당). */
export function nextZoom(current: number, deltaY: number, step: number): number {
  return current + (deltaY > 0 ? -step : step);
}

/**
 * 커서 앵커 계산. scroll geometry(scrollLeft/scrollWidth/rectLeft)로 고정점 비율을 구한다.
 * scrollWidth 0이면 null(계산 불가).
 */
export function computeZoomAnchor(
  rectLeft: number,
  scrollLeft: number,
  scrollWidth: number,
  clientX: number
): ZoomAnchor | null {
  if (scrollWidth <= 0) return null;
  const cursorX = clientX - rectLeft;
  return { ratio: (scrollLeft + cursorX) / scrollWidth, cursorX };
}

/** 앵커 기준 보정된 scrollLeft — 줌 후 content 폭(scrollWidth) 갱신 직후 적용. */
export function anchorScrollLeft(anchor: ZoomAnchor, scrollWidth: number): number {
  return anchor.ratio * scrollWidth - anchor.cursorX;
}
