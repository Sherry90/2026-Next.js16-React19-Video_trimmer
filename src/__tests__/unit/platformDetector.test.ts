import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  selectDownloadStrategy,
  type Platform,
  type DownloadStrategy,
} from '@/lib/platformDetector';

describe('platformDetector', () => {
  describe('detectPlatform', () => {
    it('detects Chzzk URLs', () => {
      const urls = [
        'https://chzzk.naver.com/live/123',
        'https://chzzk.naver.com/video/456',
        'https://CHZZK.NAVER.COM/video/789', // case insensitive
      ];

      urls.forEach((url) => {
        expect(detectPlatform(url)).toBe('chzzk');
      });
    });

    it('detects YouTube URLs', () => {
      const urls = [
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://youtu.be/dQw4w9WgXcQ',
        'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://YOUTUBE.COM/watch?v=dQw4w9WgXcQ', // case insensitive
      ];

      urls.forEach((url) => {
        expect(detectPlatform(url)).toBe('youtube');
      });
    });

    it('returns generic for other platforms', () => {
      const urls = [
        'https://twitch.tv/stream',
        'https://vimeo.com/123456',
        'https://example.com/video.mp4',
      ];

      urls.forEach((url) => {
        expect(detectPlatform(url)).toBe('generic');
      });
    });

    it('handles invalid URLs gracefully', () => {
      const invalidUrls = ['not a url', '', 'ftp://invalid'];

      invalidUrls.forEach((url) => {
        expect(detectPlatform(url)).toBe('generic');
      });
    });
  });

  describe('selectDownloadStrategy', () => {
    it('selects streamlink for Chzzk', () => {
      expect(selectDownloadStrategy('chzzk', 'hls')).toBe('streamlink');
      expect(selectDownloadStrategy('chzzk', 'mp4')).toBe('streamlink');
    });

    it('selects yt-dlp for YouTube', () => {
      expect(selectDownloadStrategy('youtube', 'hls')).toBe('ytdlp');
      expect(selectDownloadStrategy('youtube', 'mp4')).toBe('ytdlp');
    });

    it('selects yt-dlp for generic platforms', () => {
      expect(selectDownloadStrategy('generic', 'hls')).toBe('ytdlp');
      expect(selectDownloadStrategy('generic', 'mp4')).toBe('ytdlp');
    });

    it('uses default streamType when not provided', () => {
      expect(selectDownloadStrategy('youtube')).toBe('ytdlp');
    });
  });
});
