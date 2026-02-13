import { describe, it, expect } from 'vitest';
import { calculateOverallProgress, getPhaseMessage } from '@/features/url-input/utils/sseProgressUtils';

describe('sseProgressUtils', () => {
  describe('calculateOverallProgress', () => {
    it('should map downloading phase correctly (0-90%)', () => {
      expect(calculateOverallProgress('downloading', 0)).toBe(0);
      expect(calculateOverallProgress('downloading', 50)).toBe(45);
      expect(calculateOverallProgress('downloading', 100)).toBe(90);
    });

    it('should map processing phase correctly (90-100%)', () => {
      expect(calculateOverallProgress('processing', 0)).toBe(90);
      expect(calculateOverallProgress('processing', 50)).toBe(95);
      expect(calculateOverallProgress('processing', 100)).toBe(100);
    });

    it('should return 100% for completed phase', () => {
      expect(calculateOverallProgress('completed', 100)).toBe(100);
    });

    it('should ensure smooth transition between phases', () => {
      const downloadingEnd = calculateOverallProgress('downloading', 100);
      const processingStart = calculateOverallProgress('processing', 0);
      expect(downloadingEnd).toBe(processingStart); // Both should be 90%
    });
  });

  describe('getPhaseMessage', () => {
    it('should show downloading progress with time', () => {
      expect(getPhaseMessage('downloading', 10, 60)).toBe('다운로드 중 (10/60s)');
    });

    it('should round seconds for downloading', () => {
      expect(getPhaseMessage('downloading', 10.7, 60.3)).toBe('다운로드 중 (11/60s)');
    });

    it('should handle undefined seconds for downloading', () => {
      expect(getPhaseMessage('downloading', undefined, undefined)).toBe('다운로드 중 (0/0s)');
    });

    it('should show processing message', () => {
      expect(getPhaseMessage('processing')).toBe('FFmpeg로 타임스탬프 리셋 중...');
    });

    it('should show completed message', () => {
      expect(getPhaseMessage('completed')).toBe('완료!');
    });
  });
});
