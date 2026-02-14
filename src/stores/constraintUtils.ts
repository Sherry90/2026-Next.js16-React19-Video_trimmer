import { TIMELINE } from '@/constants/appConfig';

/**
 * Store 제약 조건 유틸리티
 *
 * 타임라인 및 줌 값에 대한 제약 조건 함수를 제공
 */

/**
 * InPoint 제약: 0과 outPoint 사이로 제한
 */
export function constrainInPoint(time: number, outPoint: number): number {
  return Math.max(0, Math.min(time, outPoint));
}

/**
 * OutPoint 제약: inPoint와 maxTime 사이로 제한
 */
export function constrainOutPoint(
  time: number,
  inPoint: number,
  maxTime: number
): number {
  return Math.max(inPoint, Math.min(time, maxTime));
}

/**
 * Playhead 제약: inPoint와 outPoint 사이로 제한
 */
export function constrainPlayhead(
  time: number,
  inPoint: number,
  outPoint: number
): number {
  return Math.max(inPoint, Math.min(time, outPoint));
}

/**
 * Zoom 제약: MIN_ZOOM과 MAX_ZOOM 사이로 제한
 */
export function constrainZoom(zoom: number): number {
  return Math.max(TIMELINE.MIN_ZOOM, Math.min(zoom, TIMELINE.MAX_ZOOM));
}
