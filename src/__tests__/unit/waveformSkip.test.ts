import { describe, it, expect } from 'vitest';
import { shouldSkipWaveform, scalePeaksToDuration } from '@/shared/lib/waveformCache';
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

describe('scalePeaksToDuration', () => {
  const peaks = [[1, 2, 3, 4]];

  it('길이 같으면 그대로', () => {
    expect(scalePeaksToDuration(peaks, 10, 10)).toEqual(peaks);
  });

  it('audio < video: 우측 0 패딩(파형이 좌측만 채움)', () => {
    // audio 5s, video 10s → 길이 2배, 뒤 절반 무음
    expect(scalePeaksToDuration([[1, 2, 3, 4]], 5, 10)).toEqual([[1, 2, 3, 4, 0, 0, 0, 0]]);
  });

  it('audio > video: video 길이만큼 잘라냄', () => {
    expect(scalePeaksToDuration([[1, 2, 3, 4]], 10, 5)).toEqual([[1, 2]]);
  });

  it('방어: 0 길이/빈 채널은 원본 반환', () => {
    expect(scalePeaksToDuration(peaks, 0, 10)).toEqual(peaks);
    expect(scalePeaksToDuration(peaks, 10, 0)).toEqual(peaks);
    expect(scalePeaksToDuration([[]], 5, 10)).toEqual([[]]);
  });
});
