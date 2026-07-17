import { describe, it, expect } from 'vitest';
import {
  timeToPercent,
  percentToTime,
  deltaXToTime,
  clampPercentToTrim,
  stepClamped,
} from '@/features/timeline/utils/timelineCoords';

describe('timelineCoords', () => {
  describe('timeToPercent', () => {
    it('시간을 퍼센트로 변환', () => {
      expect(timeToPercent(50, 100)).toBe(50);
      expect(timeToPercent(0, 100)).toBe(0);
      expect(timeToPercent(100, 100)).toBe(100);
    });
    it('duration 0이면 0', () => {
      expect(timeToPercent(50, 0)).toBe(0);
    });
  });

  describe('percentToTime', () => {
    it('퍼센트를 시간으로 변환', () => {
      expect(percentToTime(50, 100)).toBe(50);
      expect(percentToTime(25, 80)).toBe(20);
    });
  });

  describe('deltaXToTime', () => {
    it('픽셀 이동을 시간 이동으로 변환', () => {
      expect(deltaXToTime(100, 200, 60)).toBe(30);
    });
    it('container 폭 0이면 0', () => {
      expect(deltaXToTime(100, 0, 60)).toBe(0);
    });
  });

  describe('clampPercentToTrim', () => {
    it('트림 구간 퍼센트 범위로 클램프', () => {
      // in=20s,out=80s,dur=100 → 20%~80%
      expect(clampPercentToTrim(50, 20, 80, 100)).toBe(50);
      expect(clampPercentToTrim(10, 20, 80, 100)).toBe(20);
      expect(clampPercentToTrim(90, 20, 80, 100)).toBe(80);
    });
    it('duration 0이면 out은 100% 취급', () => {
      expect(clampPercentToTrim(50, 0, 0, 0)).toBe(50);
    });
  });

  describe('stepClamped', () => {
    it('step 적용 후 min/max 클램프', () => {
      expect(stepClamped(50, 1, 0, 100)).toBe(51);
      expect(stepClamped(99.5, 1, 0, 100)).toBe(100);
      expect(stepClamped(0.5, -1, 0, 100)).toBe(0);
    });
  });
});
