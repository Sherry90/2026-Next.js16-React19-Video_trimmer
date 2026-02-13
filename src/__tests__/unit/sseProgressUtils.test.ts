import { describe, it, expect } from 'vitest';
import {
  calculateOverallProgress,
  getPhaseMessage,
  PHASE_WEIGHTS,
} from '@/features/url-input/utils/sseProgressUtils';

describe('sseProgressUtils', () => {
  describe('PHASE_WEIGHTS', () => {
    it('should have correct weight values', () => {
      expect(PHASE_WEIGHTS.DOWNLOADING).toBe(0.9);
      expect(PHASE_WEIGHTS.PROCESSING).toBe(0.1);
    });

    it('should sum to 1.0', () => {
      const sum = PHASE_WEIGHTS.DOWNLOADING + PHASE_WEIGHTS.PROCESSING;
      expect(sum).toBe(1.0);
    });
  });

  describe('calculateOverallProgress', () => {
    describe('downloading phase', () => {
      it('should map 0% to 0%', () => {
        expect(calculateOverallProgress('downloading', 0)).toBe(0);
      });

      it('should map 50% to 45%', () => {
        expect(calculateOverallProgress('downloading', 50)).toBe(45);
      });

      it('should map 100% to 90%', () => {
        expect(calculateOverallProgress('downloading', 100)).toBe(90);
      });

      it('should round properly', () => {
        expect(calculateOverallProgress('downloading', 33.333)).toBe(30);
        expect(calculateOverallProgress('downloading', 66.666)).toBe(60);
      });
    });

    describe('processing phase', () => {
      it('should map 0% to 90%', () => {
        expect(calculateOverallProgress('processing', 0)).toBe(90);
      });

      it('should map 50% to 95%', () => {
        expect(calculateOverallProgress('processing', 50)).toBe(95);
      });

      it('should map 100% to 100%', () => {
        expect(calculateOverallProgress('processing', 100)).toBe(100);
      });

      it('should round properly', () => {
        expect(calculateOverallProgress('processing', 33.333)).toBe(93);
        expect(calculateOverallProgress('processing', 66.666)).toBe(97);
      });
    });

    describe('completed phase', () => {
      it('should always return 100%', () => {
        expect(calculateOverallProgress('completed', 0)).toBe(100);
        expect(calculateOverallProgress('completed', 50)).toBe(100);
        expect(calculateOverallProgress('completed', 100)).toBe(100);
      });
    });

    describe('edge cases', () => {
      it('should handle negative progress', () => {
        expect(calculateOverallProgress('downloading', -10)).toBe(-9);
        expect(calculateOverallProgress('processing', -10)).toBe(89);
      });

      it('should handle progress over 100%', () => {
        expect(calculateOverallProgress('downloading', 150)).toBe(135);
        expect(calculateOverallProgress('processing', 150)).toBe(105);
      });
    });

    describe('progress continuity', () => {
      it('should ensure smooth transition between phases', () => {
        const downloadingEnd = calculateOverallProgress('downloading', 100);
        const processingStart = calculateOverallProgress('processing', 0);
        expect(downloadingEnd).toBe(processingStart); // Both should be 90%
      });

      it('should never go backwards', () => {
        const progress = [
          calculateOverallProgress('downloading', 80), // 72%
          calculateOverallProgress('downloading', 100), // 90%
          calculateOverallProgress('processing', 0), // 90%
          calculateOverallProgress('processing', 50), // 95%
          calculateOverallProgress('processing', 100), // 100%
        ];

        for (let i = 1; i < progress.length; i++) {
          expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1]);
        }
      });
    });
  });

  describe('getPhaseMessage', () => {
    describe('downloading phase', () => {
      it('should show progress with time', () => {
        expect(getPhaseMessage('downloading', 10, 60)).toBe('다운로드 중 (10/60s)');
      });

      it('should round seconds', () => {
        expect(getPhaseMessage('downloading', 10.7, 60.3)).toBe('다운로드 중 (11/60s)');
      });

      it('should handle undefined seconds', () => {
        expect(getPhaseMessage('downloading', undefined, undefined)).toBe('다운로드 중 (0/0s)');
      });

      it('should handle partial undefined', () => {
        expect(getPhaseMessage('downloading', 10, undefined)).toBe('다운로드 중 (10/0s)');
        expect(getPhaseMessage('downloading', undefined, 60)).toBe('다운로드 중 (0/60s)');
      });
    });

    describe('processing phase', () => {
      it('should show FFmpeg message', () => {
        expect(getPhaseMessage('processing')).toBe('FFmpeg로 타임스탬프 리셋 중...');
      });

      it('should ignore time parameters', () => {
        expect(getPhaseMessage('processing', 10, 60)).toBe('FFmpeg로 타임스탬프 리셋 중...');
      });
    });

    describe('completed phase', () => {
      it('should show completion message', () => {
        expect(getPhaseMessage('completed')).toBe('완료!');
      });

      it('should ignore time parameters', () => {
        expect(getPhaseMessage('completed', 10, 60)).toBe('완료!');
      });
    });

    describe('edge cases', () => {
      it('should handle zero time', () => {
        expect(getPhaseMessage('downloading', 0, 0)).toBe('다운로드 중 (0/0s)');
      });

      it('should handle very large numbers', () => {
        expect(getPhaseMessage('downloading', 9999, 10000)).toBe('다운로드 중 (9999/10000s)');
      });

      it('should handle negative numbers', () => {
        expect(getPhaseMessage('downloading', -5, 60)).toBe('다운로드 중 (-5/60s)');
      });
    });
  });
});
