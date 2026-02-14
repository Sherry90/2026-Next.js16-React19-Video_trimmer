/**
 * 문자열 관련 유틸리티 함수
 */

/**
 * ANSI escape code 제거
 * @param input - 입력 문자열
 * @returns ANSI code가 제거된 문자열
 */
export function stripAnsi(input: string): string {
  return typeof input === 'string' ? input.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '') : '';
}

/**
 * 빈 문자열 검사
 * @param str - 검사할 문자열
 * @returns 빈 문자열이면 true
 */
export function isEmpty(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

/**
 * 안전한 문자열 변환
 * @param value - 변환할 값
 * @returns 문자열 (null/undefined는 빈 문자열)
 */
export function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}
