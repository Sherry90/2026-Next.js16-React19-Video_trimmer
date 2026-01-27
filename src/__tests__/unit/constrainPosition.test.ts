import { describe, it, expect } from 'vitest';
import {
  constrainTime,
  constrainInPoint,
  constrainOutPoint,
  constrainPlayhead,
} from '@/features/timeline/utils/constrainPosition';

describe('constrainPosition', () => {
  describe('constrainTime', () => {
    it('should return value within bounds', () => {
      expect(constrainTime(50, 0, 100)).toBe(50);
    });

    it('should constrain value to minimum', () => {
      expect(constrainTime(-10, 0, 100)).toBe(0);
    });

    it('should constrain value to maximum', () => {
      expect(constrainTime(150, 0, 100)).toBe(100);
    });

    it('should handle equal min and max', () => {
      expect(constrainTime(50, 10, 10)).toBe(10);
    });

    it('should handle value equal to min', () => {
      expect(constrainTime(0, 0, 100)).toBe(0);
    });

    it('should handle value equal to max', () => {
      expect(constrainTime(100, 0, 100)).toBe(100);
    });
  });

  describe('constrainInPoint', () => {
    it('should constrain in point within range', () => {
      expect(constrainInPoint(30, 100)).toBe(30);
    });

    it('should constrain to minimum (0)', () => {
      expect(constrainInPoint(-10, 100)).toBe(0);
    });

    it('should constrain to out point', () => {
      expect(constrainInPoint(150, 100)).toBe(100);
    });

    it('should handle in point at 0', () => {
      expect(constrainInPoint(0, 100)).toBe(0);
    });

    it('should handle in point at out point', () => {
      expect(constrainInPoint(100, 100)).toBe(100);
    });
  });

  describe('constrainOutPoint', () => {
    it('should constrain out point within range', () => {
      expect(constrainOutPoint(80, 20, 100)).toBe(80);
    });

    it('should constrain to in point', () => {
      expect(constrainOutPoint(10, 20, 100)).toBe(20);
    });

    it('should constrain to duration', () => {
      expect(constrainOutPoint(150, 20, 100)).toBe(100);
    });

    it('should handle out point at in point', () => {
      expect(constrainOutPoint(20, 20, 100)).toBe(20);
    });

    it('should handle out point at duration', () => {
      expect(constrainOutPoint(100, 20, 100)).toBe(100);
    });
  });

  describe('constrainPlayhead', () => {
    it('should constrain playhead within range', () => {
      expect(constrainPlayhead(50, 20, 80)).toBe(50);
    });

    it('should constrain to in point', () => {
      expect(constrainPlayhead(10, 20, 80)).toBe(20);
    });

    it('should constrain to out point', () => {
      expect(constrainPlayhead(100, 20, 80)).toBe(80);
    });

    it('should handle playhead at in point', () => {
      expect(constrainPlayhead(20, 20, 80)).toBe(20);
    });

    it('should handle playhead at out point', () => {
      expect(constrainPlayhead(80, 20, 80)).toBe(80);
    });

    it('should handle zero range', () => {
      expect(constrainPlayhead(50, 30, 30)).toBe(30);
    });
  });
});
