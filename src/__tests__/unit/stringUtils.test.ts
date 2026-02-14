import { describe, it, expect } from 'vitest';
import { stripAnsi, isEmpty, safeString } from '@/utils/stringUtils';

describe('stringUtils', () => {
  describe('stripAnsi', () => {
    it('should remove ANSI escape codes', () => {
      expect(stripAnsi('\x1B[31mRed Text\x1B[0m')).toBe('Red Text');
      expect(stripAnsi('\x1B[1;32mBold Green\x1B[0m')).toBe('Bold Green');
    });

    it('should handle strings without ANSI codes', () => {
      expect(stripAnsi('Plain Text')).toBe('Plain Text');
      expect(stripAnsi('')).toBe('');
    });

    it('should handle complex ANSI sequences', () => {
      const input = '\x1B[1;31;40mBold Red on Black\x1B[0m Normal';
      expect(stripAnsi(input)).toBe('Bold Red on Black Normal');
    });

    it('should return empty string for non-string input', () => {
      // @ts-expect-error - testing runtime behavior
      expect(stripAnsi(null)).toBe('');
      // @ts-expect-error - testing runtime behavior
      expect(stripAnsi(undefined)).toBe('');
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty strings', () => {
      expect(isEmpty('')).toBe(true);
      expect(isEmpty('   ')).toBe(true);
      expect(isEmpty('\t\n')).toBe(true);
    });

    it('should return true for null and undefined', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
    });

    it('should return false for non-empty strings', () => {
      expect(isEmpty('text')).toBe(false);
      expect(isEmpty(' text ')).toBe(false);
      expect(isEmpty('0')).toBe(false);
    });
  });

  describe('safeString', () => {
    it('should convert values to strings', () => {
      expect(safeString('text')).toBe('text');
      expect(safeString(123)).toBe('123');
      expect(safeString(true)).toBe('true');
      expect(safeString(false)).toBe('false');
    });

    it('should return empty string for null and undefined', () => {
      expect(safeString(null)).toBe('');
      expect(safeString(undefined)).toBe('');
    });

    it('should handle objects and arrays', () => {
      expect(safeString({})).toBe('[object Object]');
      expect(safeString([])).toBe('');
      expect(safeString([1, 2, 3])).toBe('1,2,3');
    });
  });
});
