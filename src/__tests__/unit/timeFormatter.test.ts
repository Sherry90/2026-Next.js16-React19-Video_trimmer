import { describe, it, expect } from 'vitest';
import { formatTime, parseTime } from '@/utils/timeFormatter';

describe('timeFormatter', () => {
  it('formatTime should format seconds to HH:MM:SS.mmm', () => {
    expect(formatTime(0)).toBe('00:00:00.000');
    expect(formatTime(125.5)).toBe('00:02:05.500');
    expect(formatTime(3665.123)).toBe('01:01:05.123');
  });

  it('parseTime should parse HH:MM:SS.mmm to seconds', () => {
    expect(parseTime('00:00:00.000')).toBe(0);
    expect(parseTime('00:02:05.500')).toBe(125.5);
    expect(parseTime('01:01:05.123')).toBeCloseTo(3665.123, 2);
  });
});
