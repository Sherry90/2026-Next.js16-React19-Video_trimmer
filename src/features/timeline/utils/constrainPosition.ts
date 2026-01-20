/**
 * 시간 값을 최소값과 최대값 사이로 제한
 */
export function constrainTime(
  time: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(time, max));
}

/**
 * 인 포인트 제약: 0 ~ 아웃 포인트 사이
 */
export function constrainInPoint(time: number, outPoint: number): number {
  return constrainTime(time, 0, outPoint);
}

/**
 * 아웃 포인트 제약: 인 포인트 ~ 영상 끝 사이
 */
export function constrainOutPoint(
  time: number,
  inPoint: number,
  duration: number
): number {
  return constrainTime(time, inPoint, duration);
}

/**
 * 플레이헤드 제약: 인 포인트 ~ 아웃 포인트 사이
 */
export function constrainPlayhead(
  time: number,
  inPoint: number,
  outPoint: number
): number {
  return constrainTime(time, inPoint, outPoint);
}
