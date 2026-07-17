/**
 * 재생 가드 술어 (순수 함수).
 *
 * video.js timeupdate 콜백에서 파생 판정을 분리해 테스트 가능하게 한다.
 */

/**
 * outPoint 자동 정지 조건.
 * 재생 중(!paused)이고 현재 시각이 outPoint 이상이며 outPoint가 유효(>0)할 때 true.
 */
export function shouldAutoPauseAtOut(
  currentTime: number,
  outPoint: number,
  paused: boolean
): boolean {
  return currentTime >= outPoint && outPoint > 0 && !paused;
}
