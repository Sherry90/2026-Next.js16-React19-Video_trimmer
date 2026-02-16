import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildYtdlpArgs } from '@/lib/ytdlpDownloader';
import { getFfmpegPath } from '@/lib/binPaths';

// Mock binPaths
vi.mock('@/lib/binPaths', () => ({
  getFfmpegPath: vi.fn(() => '/usr/local/bin/ffmpeg'),
  getYtdlpPath: vi.fn(() => '/usr/local/bin/yt-dlp'),
}));

describe('ytdlpDownloader', () => {
  describe('buildYtdlpArgs', () => {
    const baseParams = {
      url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      startTime: 60,
      endTime: 180,
      outputPath: '/tmp/output.mp4',
    };

    it('builds correct command for time range', () => {
      const args = buildYtdlpArgs(baseParams);

      expect(args).toContain('--download-sections');
      const sectionIndex = args.indexOf('--download-sections');
      expect(args[sectionIndex + 1]).toBe('*60-180');
    });

    it('uses 1080p quality by default', () => {
      const args = buildYtdlpArgs(baseParams);

      const formatIndex = args.indexOf('-f');
      expect(formatIndex).toBeGreaterThan(-1);
      expect(args[formatIndex + 1]).toBe('bestvideo[height<=?1080]+bestaudio/best');
    });

    it('uses best quality when specified', () => {
      const args = buildYtdlpArgs({ ...baseParams, quality: 'best' });

      const formatIndex = args.indexOf('-f');
      expect(args[formatIndex + 1]).toBe('bv+ba/b');
    });

    it('uses 6 concurrent threads for parallel download', () => {
      const args = buildYtdlpArgs(baseParams);

      expect(args).toContain('-N');
      const concurrentIndex = args.indexOf('-N');
      expect(args[concurrentIndex + 1]).toBe('6');
    });

    it('specifies ffmpeg location', () => {
      const args = buildYtdlpArgs(baseParams);

      expect(args).toContain('--ffmpeg-location');
      const ffmpegIndex = args.indexOf('--ffmpeg-location');
      expect(args[ffmpegIndex + 1]).toBe(getFfmpegPath());
    });

    it('includes --no-playlist flag', () => {
      const args = buildYtdlpArgs(baseParams);
      expect(args).toContain('--no-playlist');
    });

    it('includes --newline flag for progress parsing', () => {
      const args = buildYtdlpArgs(baseParams);
      expect(args).toContain('--newline');
    });

    it('forces mp4 output format to prevent extension mismatch', () => {
      const args = buildYtdlpArgs(baseParams);

      expect(args).toContain('--merge-output-format');
      const formatIndex = args.indexOf('--merge-output-format');
      expect(args[formatIndex + 1]).toBe('mp4');
    });

    it('includes output path with -o flag', () => {
      const args = buildYtdlpArgs(baseParams);

      expect(args).toContain('-o');
      const outputIndex = args.indexOf('-o');
      expect(args[outputIndex + 1]).toBe(baseParams.outputPath);
    });

    it('includes URL as last argument', () => {
      const args = buildYtdlpArgs(baseParams);
      expect(args[args.length - 1]).toBe(baseParams.url);
    });

    it('handles different time ranges', () => {
      const testCases = [
        { startTime: 0, endTime: 60, expected: '*0-60' },
        { startTime: 100, endTime: 200, expected: '*100-200' },
        { startTime: 3600, endTime: 7200, expected: '*3600-7200' },
      ];

      testCases.forEach(({ startTime, endTime, expected }) => {
        const args = buildYtdlpArgs({ ...baseParams, startTime, endTime });
        const sectionIndex = args.indexOf('--download-sections');
        expect(args[sectionIndex + 1]).toBe(expected);
      });
    });
  });
});
