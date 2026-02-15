import { describe, it, expect } from 'vitest';
import {
  formatTime,
  parseTime,
  formatSimpleTime,
} from '@/utils/timeFormatter';

describe('timeFormatter', () => {
  describe('formatTime', () => {
    it('should format zero seconds correctly', () => {
      expect(formatTime(0)).toBe('00:00:00.000');
    });

    it('should format seconds without hours', () => {
      expect(formatTime(125.5)).toBe('00:02:05.500');
    });

    it('should format time with hours', () => {
      expect(formatTime(3665.123)).toBe('01:01:05.123');
    });

    it('should format time with all components', () => {
      // Use integer seconds plus milliseconds to avoid floating point precision issues
      const result = formatTime(7384.5);
      expect(result).toBe('02:03:04.500');
    });

    it('should handle fractional milliseconds', () => {
      expect(formatTime(1.2345)).toBe('00:00:01.234');
    });

    it('should pad single digits correctly', () => {
      // Test with integer milliseconds to avoid floating point precision issues
      expect(formatTime(5.049)).toBe('00:00:05.049');
    });
  });

  describe('parseTime', () => {
    it('should parse zero time correctly', () => {
      expect(parseTime('00:00:00.000')).toBe(0);
    });

    it('should parse time without milliseconds', () => {
      expect(parseTime('00:02:05')).toBe(125);
    });

    it('should parse time with milliseconds', () => {
      expect(parseTime('00:02:05.500')).toBe(125.5);
    });

    it('should parse time with hours', () => {
      expect(parseTime('01:01:05.123')).toBe(3665.123);
    });

    it('should handle invalid format', () => {
      expect(parseTime('invalid')).toBe(0);
    });

    it('should handle partial time format', () => {
      expect(parseTime('05:30')).toBe(0);
    });

    it('should handle non-numeric values', () => {
      expect(parseTime('aa:bb:cc')).toBe(0);
    });
  });

  describe('formatSimpleTime', () => {
    it('should format zero seconds correctly', () => {
      expect(formatSimpleTime(0)).toBe('00:00');
    });

    it('should format seconds correctly', () => {
      expect(formatSimpleTime(125)).toBe('02:05');
    });

    it('should format time over an hour', () => {
      expect(formatSimpleTime(3665)).toBe('61:05');
    });

    it('should pad single digits', () => {
      expect(formatSimpleTime(5)).toBe('00:05');
    });

    it('should ignore fractional seconds', () => {
      expect(formatSimpleTime(125.999)).toBe('02:05');
    });
  });
});
