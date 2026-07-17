/**
 * 타임라인 좌표 변환 유틸 (순수 함수 — React/스토어 비의존).
 *
 * 드래그는 퍼센트(0-100) 좌표로 다루고 시간(초)과 오가므로 변환을 한곳에 모은다.
 * Playhead/TrimHandle 드래그 스마트 hook과 키보드 탐색에서 재사용.
 */

/** 시간(초) → content 폭 기준 퍼센트(0-100). duration 0이면 0. */
export function timeToPercent(time: number, duration: number): number {
  return duration > 0 ? (time / duration) * 100 : 0;
}

/** 퍼센트(0-100) → 시간(초). */
export function percentToTime(percent: number, duration: number): number {
  return (percent / 100) * duration;
}

/** 픽셀 이동량(deltaX) → 시간 이동량(초). container 폭 기준. */
export function deltaXToTime(deltaX: number, containerWidth: number, duration: number): number {
  return containerWidth > 0 ? (deltaX / containerWidth) * duration : 0;
}

/** 퍼센트를 트림 구간(in/out)의 퍼센트 범위로 클램프. */
export function clampPercentToTrim(
  percent: number,
  inPoint: number,
  outPoint: number,
  duration: number
): number {
  const inPercent = timeToPercent(inPoint, duration);
  const outPercent = duration > 0 ? timeToPercent(outPoint, duration) : 100;
  return Math.max(inPercent, Math.min(percent, outPercent));
}

/** time에 step을 더한 뒤 [min, max]로 클램프 — 키보드 프레임/초 이동용. */
export function stepClamped(time: number, step: number, min: number, max: number): number {
  return Math.max(min, Math.min(time + step, max));
}
