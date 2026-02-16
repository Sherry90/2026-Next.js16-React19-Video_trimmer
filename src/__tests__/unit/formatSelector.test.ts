import { describe, it, expect } from 'vitest';
import {
  buildYtdlpFormatSpec,
  DEFAULT_QUALITY,
  QUALITY_PRESETS,
  type QualityConfig,
} from '@/lib/formatSelector';

describe('formatSelector - yt-dlp quality selection', () => {
  describe('buildYtdlpFormatSpec', () => {
    it('builds flexible 1080p format spec by default', () => {
      const spec = buildYtdlpFormatSpec();
      expect(spec).toBe('bestvideo[height<=?1080]+bestaudio/best');
    });

    it('builds strict format spec when strictMode is true', () => {
      const config: QualityConfig = { maxHeight: 1080, strictMode: true };
      const spec = buildYtdlpFormatSpec(config);
      expect(spec).toBe('bestvideo[height<=1080]+bestaudio');
    });

    it('builds flexible format spec when strictMode is false', () => {
      const config: QualityConfig = { maxHeight: 1080, strictMode: false };
      const spec = buildYtdlpFormatSpec(config);
      expect(spec).toBe('bestvideo[height<=?1080]+bestaudio/best');
    });

    it('handles different quality heights', () => {
      const testCases = [
        { maxHeight: 720, strictMode: false, expected: 'bestvideo[height<=?720]+bestaudio/best' },
        { maxHeight: 480, strictMode: false, expected: 'bestvideo[height<=?480]+bestaudio/best' },
        { maxHeight: 1440, strictMode: false, expected: 'bestvideo[height<=?1440]+bestaudio/best' },
        { maxHeight: 720, strictMode: true, expected: 'bestvideo[height<=720]+bestaudio' },
      ];

      testCases.forEach(({ maxHeight, strictMode, expected }) => {
        const config: QualityConfig = { maxHeight, strictMode };
        expect(buildYtdlpFormatSpec(config)).toBe(expected);
      });
    });

    it('uses DEFAULT_QUALITY when no config provided', () => {
      const specWithDefault = buildYtdlpFormatSpec();
      const specWithExplicit = buildYtdlpFormatSpec(DEFAULT_QUALITY);
      expect(specWithDefault).toBe(specWithExplicit);
    });
  });

  describe('DEFAULT_QUALITY', () => {
    it('has correct default values', () => {
      expect(DEFAULT_QUALITY.maxHeight).toBe(1080);
      expect(DEFAULT_QUALITY.strictMode).toBe(false);
    });
  });

  describe('QUALITY_PRESETS', () => {
    it('has FHD_1080P preset', () => {
      expect(QUALITY_PRESETS.FHD_1080P).toEqual({
        maxHeight: 1080,
        strictMode: false,
      });
    });

    it('has HD_720P preset', () => {
      expect(QUALITY_PRESETS.HD_720P).toEqual({
        maxHeight: 720,
        strictMode: false,
      });
    });

    it('has SD_480P preset', () => {
      expect(QUALITY_PRESETS.SD_480P).toEqual({
        maxHeight: 480,
        strictMode: false,
      });
    });

    it('has BEST preset', () => {
      expect(QUALITY_PRESETS.BEST).toEqual({
        maxHeight: 9999,
        strictMode: false,
      });
    });

    it('all presets use flexible mode', () => {
      Object.values(QUALITY_PRESETS).forEach((preset) => {
        expect(preset.strictMode).toBe(false);
      });
    });
  });
});
