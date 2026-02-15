import { describe, it, expect } from 'vitest';
import { stripAnsi, isEmpty, safeString } from '@/utils/stringUtils';

describe('stringUtils', () => {
  it('stripAnsi should remove ANSI escape codes', () => {
    expect(stripAnsi('\x1B[31mRed Text\x1B[0m')).toBe('Red Text');
    expect(stripAnsi('Plain Text')).toBe('Plain Text');
  });

  it('isEmpty should detect empty strings', () => {
    expect(isEmpty('')).toBe(true);
    expect(isEmpty('text')).toBe(false);
  });

  it('safeString should convert to string safely', () => {
    expect(safeString('text')).toBe('text');
    expect(safeString(null)).toBe('');
    expect(safeString(123)).toBe('123');
  });
});
