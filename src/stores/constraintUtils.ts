import { TIMELINE, AUDIO } from "@/constants/appConfig";

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
export function constrainOutPoint(time: number, inPoint: number, maxTime: number): number {
  return Math.max(inPoint, Math.min(time, maxTime));
}

/**
 * Playhead 제약: inPoint와 outPoint 사이로 제한
 */
export function constrainPlayhead(time: number, inPoint: number, outPoint: number): number {
  return Math.max(inPoint, Math.min(time, outPoint));
}

/**
 * Zoom 제약: MIN_ZOOM과 MAX_ZOOM 사이로 제한
 */
export function constrainZoom(zoom: number): number {
  return Math.max(TIMELINE.MIN_ZOOM, Math.min(zoom, TIMELINE.MAX_ZOOM));
}

/**
 * 출력 게인 제약: MIN_GAIN_DB~MAX_GAIN_DB로 제한하고 GAIN_STEP_DB 배수로 반올림.
 * 비유한값은 DEFAULT_GAIN_DB로 되돌리고, 0 근처(±GAIN_SNAP_EPSILON_DB)는 0dB로 스냅한다.
 * 클라이언트 입력과 서버 수신 양쪽에서 동일하게 호출한다(값 신뢰 금지).
 */
export function constrainOutputGainDb(db: number): number {
  if (!Number.isFinite(db)) return AUDIO.DEFAULT_GAIN_DB;
  if (Math.abs(db) <= AUDIO.GAIN_SNAP_EPSILON_DB) return AUDIO.DEFAULT_GAIN_DB;
  const clamped = Math.max(AUDIO.MIN_GAIN_DB, Math.min(db, AUDIO.MAX_GAIN_DB));
  const stepped = Math.round(clamped / AUDIO.GAIN_STEP_DB) * AUDIO.GAIN_STEP_DB;
  // 부동소수 잔차 제거 (0.5 스텝이면 소수 1자리로 충분)
  return Number(stepped.toFixed(1));
}
