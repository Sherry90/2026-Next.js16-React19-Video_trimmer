/**
 * className 병합 유틸 — falsy(false/null/undefined/'')를 걸러 공백으로 join.
 * clsx/tailwind-merge 없이 조건부 클래스 조합용 (충돌 클래스 자동 병합은 하지 않음).
 *
 * @example cn('base', isActive && 'active', className)
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
