import { describe, it, expect } from 'vitest';
import { formatTime, parseFlexibleTime } from '@/utils/timeFormatter';

describe('formatTime', () => {
  it('초를 HH:MM:SS.mmm 형식으로 변환', () => {
    expect(formatTime(0)).toBe('00:00:00.000');
    expect(formatTime(125.5)).toBe('00:02:05.500');
    expect(formatTime(3665.123)).toBe('01:01:05.123');
  });

  it('includeMs=false 시 HH:MM:SS 형식으로 변환', () => {
    expect(formatTime(0, false)).toBe('00:00:00');
    expect(formatTime(90, false)).toBe('00:01:30');
    expect(formatTime(3665, false)).toBe('01:01:05');
  });
});

describe('parseFlexibleTime', () => {
  it('단일 숫자(초)를 파싱', () => {
    expect(parseFlexibleTime('30')).toBe(30);
    expect(parseFlexibleTime('1.5')).toBe(1.5);
  });

  it('MM:SS 형식을 파싱', () => {
    expect(parseFlexibleTime('1:30')).toBe(90);
    expect(parseFlexibleTime('1:30.500')).toBeCloseTo(90.5, 3);
    expect(parseFlexibleTime('1:90')).toBe(0); // 초가 59 초과 → 무효
  });

  it('HH:MM:SS 형식을 파싱', () => {
    expect(parseFlexibleTime('01:02:03')).toBe(3723);
    expect(parseFlexibleTime('1:1:1')).toBe(3661);
  });

  it('유효하지 않은 입력은 0을 반환', () => {
    expect(parseFlexibleTime('')).toBe(0);
    expect(parseFlexibleTime('abc')).toBe(0);
    expect(parseFlexibleTime('1:2:3:4')).toBe(0);
  });

  it('앞뒤 공백을 무시', () => {
    expect(parseFlexibleTime('  90  ')).toBe(90);
  });
});
