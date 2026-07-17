import { describe, it, expect } from 'vitest';
import { shouldAutoPauseAtOut } from '@/features/player/utils/playbackGuards';

describe('shouldAutoPauseAtOut', () => {
  it('재생 중 outPoint 도달 시 true', () => {
    expect(shouldAutoPauseAtOut(80, 80, false)).toBe(true);
    expect(shouldAutoPauseAtOut(81, 80, false)).toBe(true);
  });
  it('outPoint 이전이면 false', () => {
    expect(shouldAutoPauseAtOut(50, 80, false)).toBe(false);
  });
  it('이미 정지(paused)면 false', () => {
    expect(shouldAutoPauseAtOut(80, 80, true)).toBe(false);
  });
  it('outPoint 0(미설정)이면 false', () => {
    expect(shouldAutoPauseAtOut(0, 0, false)).toBe(false);
  });
});
