import { describe, it, expect } from 'vitest';
import { shouldSkipWaveform } from '@/shared/lib/waveformCache';
import { WAVEFORM } from '@/constants/appConfig';

describe('shouldSkipWaveform', () => {
  const MAX = WAVEFORM.MAX_DURATION_SEC; // 3600

  it('임계값 이하는 생략 안 함', () => {
    expect(shouldSkipWaveform(0)).toBe(false);
    expect(shouldSkipWaveform(60)).toBe(false);
    expect(shouldSkipWaveform(MAX)).toBe(false); // 경계: 같으면 생략 안 함
  });

  it('임계값 초과는 생략', () => {
    expect(shouldSkipWaveform(MAX + 1)).toBe(true);
    expect(shouldSkipWaveform(16169)).toBe(true); // 4.5h 실제 케이스
  });

  it('임계값은 1시간', () => {
    expect(MAX).toBe(3600);
  });
});
