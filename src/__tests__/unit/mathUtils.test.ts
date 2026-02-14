import { describe, it, expect } from 'vitest';
import { clamp, toPercentage } from '@/utils/mathUtils';

describe('mathUtils', () => {
  describe('clamp', () => {
    it('should return value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should clamp to min when value is below range', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(-100, 0, 10)).toBe(0);
    });

    it('should clamp to max when value is above range', () => {
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(100, 0, 10)).toBe(10);
    });

    it('should work with floating point numbers', () => {
      expect(clamp(5.5, 0, 10)).toBe(5.5);
      expect(clamp(10.1, 0, 10)).toBe(10);
      expect(clamp(-0.1, 0, 10)).toBe(0);
    });

    it('should work with negative ranges', () => {
      expect(clamp(-5, -10, 0)).toBe(-5);
      expect(clamp(-15, -10, 0)).toBe(-10);
      expect(clamp(5, -10, 0)).toBe(0);
    });
  });

  describe('toPercentage', () => {
    it('should convert value to percentage', () => {
      expect(toPercentage(50, 100)).toBe(50);
      expect(toPercentage(25, 100)).toBe(25);
      expect(toPercentage(100, 100)).toBe(100);
    });

    it('should return 0 for zero value', () => {
      expect(toPercentage(0, 100)).toBe(0);
    });

    it('should clamp result between 0 and 100', () => {
      expect(toPercentage(150, 100)).toBe(100);
      expect(toPercentage(-50, 100)).toBe(0);
    });

    it('should return 0 for invalid inputs', () => {
      expect(toPercentage(50, 0)).toBe(0); // division by zero
      expect(toPercentage(50, -100)).toBe(0); // negative total
      expect(toPercentage(-50, 100)).toBe(0); // negative value
      expect(toPercentage(NaN, 100)).toBe(0);
      expect(toPercentage(50, NaN)).toBe(0);
      expect(toPercentage(Infinity, 100)).toBe(0);
      expect(toPercentage(50, Infinity)).toBe(0);
    });

    it('should handle floating point calculations', () => {
      expect(toPercentage(33.33, 100)).toBeCloseTo(33.33, 2);
      expect(toPercentage(66.66, 100)).toBeCloseTo(66.66, 2);
    });
  });
});
