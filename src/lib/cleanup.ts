/**
 * Cleanup 레지스트리
 *
 * 전역 cleanup 함수들을 등록하고 일괄 실행
 * Store가 Features에 직접 의존하지 않도록 의존성 역전 패턴 적용
 */

type CleanupFunction = () => void;

/**
 * 등록된 cleanup 함수들
 */
const cleanupRegistry: CleanupFunction[] = [];

/**
 * Cleanup 함수 등록
 *
 * @param fn - cleanup 함수
 *
 * @example
 * ```typescript
 * // 모듈 로드 시 cleanup 등록
 * registerCleanup(() => {
 *   if (ffmpegInstance) {
 *     ffmpegInstance.terminate();
 *   }
 * });
 * ```
 */
export function registerCleanup(fn: CleanupFunction): void {
  if (!cleanupRegistry.includes(fn)) {
    cleanupRegistry.push(fn);
  }
}

/**
 * 등록된 모든 cleanup 함수 실행
 *
 * 에러가 발생해도 나머지 cleanup은 계속 실행
 */
export function runAllCleanups(): void {
  cleanupRegistry.forEach((fn) => {
    try {
      fn();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });
}
