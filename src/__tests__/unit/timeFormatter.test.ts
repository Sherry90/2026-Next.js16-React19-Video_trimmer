import { describe, it, expect } from 'vitest';
import { formatTime, parseTime, parseFlexibleTime } from '@/utils/timeFormatter';

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

describe('parseFlexibleTime', () => {
  describe('단일 숫자 형식', () => {
    it('0을 올바르게 파싱', () => expect(parseFlexibleTime('0')).toBe(0));
    it('정수 초를 파싱', () => expect(parseFlexibleTime('30')).toBe(30));
    it('60초를 파싱', () => expect(parseFlexibleTime('60')).toBe(60));
    it('90초를 파싱', () => expect(parseFlexibleTime('90')).toBe(90));
    it('3600초를 파싱', () => expect(parseFlexibleTime('3600')).toBe(3600));
    it('소수점 초를 파싱', () => expect(parseFlexibleTime('1.5')).toBe(1.5));
  });

  describe('MM:SS 형식', () => {
    it('"1:30" → 90초', () => expect(parseFlexibleTime('1:30')).toBe(90));
    it('"0:45" → 45초', () => expect(parseFlexibleTime('0:45')).toBe(45));
    it('"90:30" → 5430초 (minutes 상한 없음)', () => expect(parseFlexibleTime('90:30')).toBe(5430));
    it('"1:30.500" → 90.5초 (밀리초 포함)', () => expect(parseFlexibleTime('1:30.500')).toBeCloseTo(90.5, 3));
    it('"1:90" → 0 (초가 59 초과)', () => expect(parseFlexibleTime('1:90')).toBe(0));
    it('"1:05" → 65초 (선행 0)', () => expect(parseFlexibleTime('1:05')).toBe(65));
  });

  describe('HH:MM:SS 형식', () => {
    it('"01:02:03" → 3723초', () => expect(parseFlexibleTime('01:02:03')).toBe(3723));
    it('"1:1:1" → 3661초', () => expect(parseFlexibleTime('1:1:1')).toBe(3661));
    it('"00:00:00.000" → 0', () => expect(parseFlexibleTime('00:00:00.000')).toBe(0));
  });

  describe('유효하지 않은 입력', () => {
    it('빈 문자열 → 0', () => expect(parseFlexibleTime('')).toBe(0));
    it('문자열 → 0', () => expect(parseFlexibleTime('abc')).toBe(0));
    it('음수 → 0', () => expect(parseFlexibleTime('-10')).toBe(0));
    it('콜론 3개 → 0', () => expect(parseFlexibleTime('1:2:3:4')).toBe(0));
    it('공백만 → 0', () => expect(parseFlexibleTime('  ')).toBe(0));
    it('음수 컴포넌트 → 0', () => expect(parseFlexibleTime('1:-30')).toBe(0));
  });

  describe('엣지 케이스', () => {
    it('앞뒤 공백 트리밍', () => expect(parseFlexibleTime('  90  ')).toBe(90));
    it('"0:00" → 0', () => expect(parseFlexibleTime('0:00')).toBe(0));
    it('"1:30.1" → 90.1초 (한 자리 밀리초)', () => expect(parseFlexibleTime('1:30.1')).toBeCloseTo(90.1, 1));
  });
});
