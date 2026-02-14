/**
 * Browser API 관련 타입 및 타입 가드
 */

/**
 * Performance Memory 인터페이스 (Chrome/Edge에서 지원)
 */
export interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * Memory API를 포함한 Performance 인터페이스
 */
export interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

/**
 * Performance 객체가 memory API를 지원하는지 확인하는 타입 가드
 */
export function hasMemoryAPI(
  perf: Performance
): perf is PerformanceWithMemory & { memory: PerformanceMemory } {
  return (
    'memory' in perf &&
    perf.memory !== undefined &&
    typeof (perf.memory as PerformanceMemory).usedJSHeapSize === 'number'
  );
}
