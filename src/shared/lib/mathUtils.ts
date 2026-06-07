/**
 * 수학 관련 유틸리티 함수
 */

/**
 * 값을 지정된 범위로 제한
 * @param value - 제한할 값
 * @param min - 최솟값
 * @param max - 최댓값
 * @returns min과 max 사이로 제한된 값
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * 값을 백분율로 변환 (0-100)
 * @param value - 현재 값
 * @param total - 전체 값
 * @returns 0-100 사이의 백분율
 */
export function toPercentage(value: number, total: number): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return clamp((value / total) * 100, 0, 100);
}
