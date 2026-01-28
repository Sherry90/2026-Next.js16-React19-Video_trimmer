/**
 * Browser memory monitoring utilities
 */

// 권장 파일 크기: 500MB
const RECOMMENDED_FILE_SIZE = 500 * 1024 * 1024; // 500MB in bytes

// 경고 파일 크기: 1GB
const WARNING_FILE_SIZE = 1024 * 1024 * 1024; // 1GB in bytes

// 메모리 안전 배수 (파일 크기의 3배 메모리 필요)
const MEMORY_MULTIPLIER = 3;

/**
 * Check if browser's memory API is available
 */
export function isMemoryAPIAvailable(): boolean {
  return !!(
    typeof performance !== 'undefined' &&
    'memory' in performance &&
    performance.memory
  );
}

/**
 * Get available browser memory (if API is available)
 * Returns memory in bytes, or null if API is not available
 */
export function getAvailableMemory(): number | null {
  if (!isMemoryAPIAvailable()) {
    return null;
  }

  const memory = (performance as any).memory;
  const usedMemory = memory.usedJSHeapSize;
  const totalMemory = memory.jsHeapSizeLimit;

  return totalMemory - usedMemory;
}

/**
 * Check if there's enough memory to process the file
 * @param fileSize - File size in bytes
 * @returns true if likely safe, false if likely to fail
 */
export function checkMemoryAvailability(fileSize: number): boolean {
  const availableMemory = getAvailableMemory();

  // Memory API 사용 불가능한 경우, 파일 크기 기반 추정
  if (availableMemory === null) {
    // 1GB 이상 파일은 위험
    if (fileSize > WARNING_FILE_SIZE) {
      return false;
    }
    // 500MB 이하는 일반적으로 안전
    return true;
  }

  // 필요한 메모리 = 파일 크기 * 3 (입력 버퍼 + 처리 버퍼 + 출력 버퍼)
  const requiredMemory = fileSize * MEMORY_MULTIPLIER;

  return availableMemory > requiredMemory;
}

/**
 * Get memory recommendation for file size
 */
export function getMemoryRecommendation(
  fileSize: number
): 'safe' | 'warning' | 'danger' {
  if (fileSize <= RECOMMENDED_FILE_SIZE) {
    return 'safe';
  }
  if (fileSize <= WARNING_FILE_SIZE) {
    return 'warning';
  }
  return 'danger';
}

/**
 * Get memory status message for user
 */
export function getMemoryStatusMessage(fileSize: number): string | null {
  const recommendation = getMemoryRecommendation(fileSize);
  const availableMemory = getAvailableMemory();

  if (recommendation === 'safe') {
    return null; // No warning needed
  }

  if (recommendation === 'warning') {
    if (availableMemory !== null && !checkMemoryAvailability(fileSize)) {
      return '파일이 커서 처리 중 메모리 부족이 발생할 수 있습니다. 500MB 이하 파일 사용을 권장합니다.';
    }
    return '파일이 큽니다. 처리 시간이 오래 걸릴 수 있습니다.';
  }

  // danger
  return '파일이 너무 큽니다. 브라우저 메모리 한계로 처리에 실패할 수 있습니다. 500MB 이하 파일 사용을 권장합니다.';
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
