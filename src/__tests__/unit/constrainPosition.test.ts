import { describe, it, expect } from 'vitest';
import {
  constrainInPoint,
  constrainOutPoint,
  constrainPlayhead,
} from '@/features/timeline/utils/constrainPosition';

describe('constrainPosition', () => {
  it('constrainInPoint should limit between 0 and outPoint', () => {
    expect(constrainInPoint(30, 100)).toBe(30);
    expect(constrainInPoint(-10, 100)).toBe(0);
    expect(constrainInPoint(150, 100)).toBe(100);
  });

  it('constrainOutPoint should limit between inPoint and maxTime', () => {
    expect(constrainOutPoint(80, 20, 100)).toBe(80);
    expect(constrainOutPoint(10, 20, 100)).toBe(20);
    expect(constrainOutPoint(150, 20, 100)).toBe(100);
  });

  it('constrainPlayhead should limit between inPoint and outPoint', () => {
    expect(constrainPlayhead(50, 20, 80)).toBe(50);
    expect(constrainPlayhead(10, 20, 80)).toBe(20);
    expect(constrainPlayhead(100, 20, 80)).toBe(80);
  });
});
