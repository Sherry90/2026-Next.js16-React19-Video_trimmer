import { describe, it, expect, beforeEach } from 'vitest';
import { YtdlpProgressParser } from '@/lib/progressParser';

describe('YtdlpProgressParser', () => {
  let parser: YtdlpProgressParser;

  beforeEach(() => {
    parser = new YtdlpProgressParser();
  });

  describe('parseLine', () => {
    it('parses percentage progress correctly', () => {
      const testCases = [
        { line: '[download] 45.2% of 123.45MiB at 1.23MiB/s ETA 00:12', expected: 45.2 },
        { line: '[download] 0.0% of 123.45MiB', expected: 0.0 },
        { line: '[download] 100.0% of 123.45MiB', expected: 100.0 },
        { line: '[download]   50%   of 100MiB', expected: 50 },
      ];

      testCases.forEach(({ line, expected }) => {
        const freshParser = new YtdlpProgressParser(); // Each test case gets fresh parser
        const progress = freshParser.parseLine(line);
        expect(progress).toBe(expected);
      });
    });

    it('ensures monotonically increasing progress', () => {
      parser.parseLine('[download] 50% of 100MiB');
      expect(parser.getProgress()).toBe(50);

      // 역행하는 진행률은 무시됨
      const lower = parser.parseLine('[download] 30% of 100MiB');
      expect(lower).toBe(50);
      expect(parser.getProgress()).toBe(50);

      // 증가하는 진행률은 반영됨
      const higher = parser.parseLine('[download] 75% of 100MiB');
      expect(higher).toBe(75);
      expect(parser.getProgress()).toBe(75);
    });

    it('returns null for non-matching lines', () => {
      const invalidLines = [
        '',
        'Some other output',
        '[ffmpeg] Merging formats',
        'Downloading webpage',
        '[download] Destination: video.mp4',
      ];

      invalidLines.forEach((line) => {
        expect(parser.parseLine(line)).toBeNull();
      });
    });

    it('handles edge cases', () => {
      const parser1 = new YtdlpProgressParser();
      expect(parser1.parseLine('[download] 0% of 100MiB')).toBe(0);

      const parser2 = new YtdlpProgressParser();
      expect(parser2.parseLine('[download] 100% of 100MiB')).toBe(100);

      const parser3 = new YtdlpProgressParser();
      expect(parser3.parseLine('[download] 99.9% of 100MiB')).toBe(99.9);
    });

    it('validates progress range', () => {
      // 범위를 벗어난 값은 무시되어야 함 (실제로는 yt-dlp가 100 초과 값을 출력하지 않음)
      expect(parser.parseLine('[download] 150% of 100MiB')).toBeNull();
      expect(parser.parseLine('[download] -10% of 100MiB')).toBeNull();
    });
  });

  describe('getProgress', () => {
    it('returns 0 initially', () => {
      expect(parser.getProgress()).toBe(0);
    });

    it('returns last valid progress', () => {
      parser.parseLine('[download] 25% of 100MiB');
      expect(parser.getProgress()).toBe(25);

      parser.parseLine('[download] 50% of 100MiB');
      expect(parser.getProgress()).toBe(50);
    });

    it('maintains progress across non-matching lines', () => {
      parser.parseLine('[download] 40% of 100MiB');
      expect(parser.getProgress()).toBe(40);

      parser.parseLine('Some other output');
      expect(parser.getProgress()).toBe(40);

      parser.parseLine('[download] 60% of 100MiB');
      expect(parser.getProgress()).toBe(60);
    });
  });
});
