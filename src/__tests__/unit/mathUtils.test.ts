import { describe, it, expect } from 'vitest';
import { clamp, toPercentage } from '@/utils/mathUtils';

describe('mathUtils', () => {
  it('clamp should constrain value to range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('toPercentage should convert to 0-100 range', () => {
    expect(toPercentage(50, 100)).toBe(50);
    expect(toPercentage(150, 100)).toBe(100);
    expect(toPercentage(0, 100)).toBe(0);
  });
});
