/**
 * Process 관련 타입 및 타입 가드
 */

/**
 * Process 에러 인터페이스
 */
export interface ProcessError extends Error {
  code?: string;
  killed?: boolean;
  stderr?: string;
  exitCode?: number;
}

/**
 * ProcessError 타입 가드
 */
export function isProcessError(error: unknown): error is ProcessError {
  return error instanceof Error;
}

/**
 * unknown을 ProcessError로 안전하게 변환
 */
export function toProcessError(error: unknown): ProcessError {
  if (isProcessError(error)) {
    return error;
  }

  const err = new Error(String(error)) as ProcessError;
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.code === 'string') err.code = obj.code;
    if (typeof obj.stderr === 'string') err.stderr = obj.stderr;
    if (typeof obj.exitCode === 'number') err.exitCode = obj.exitCode;
  }

  return err;
}
