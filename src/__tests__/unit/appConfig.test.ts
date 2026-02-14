import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from '@/constants/appConfig';

describe('APP_CONFIG', () => {
  describe('TIMELINE', () => {
    it('should have valid timeline configuration', () => {
      expect(APP_CONFIG.TIMELINE.MAX_SEGMENT_DURATION_SECONDS).toBe(600);
      expect(APP_CONFIG.TIMELINE.MIN_ZOOM).toBe(0.1);
      expect(APP_CONFIG.TIMELINE.MAX_ZOOM).toBe(10);
      expect(APP_CONFIG.TIMELINE.PLAYHEAD_SEEK_THROTTLE_MS).toBe(50);
      expect(APP_CONFIG.TIMELINE.SEEK_VERIFICATION_TIMEOUT_MS).toBe(1000);
      expect(APP_CONFIG.TIMELINE.SEEK_FALLBACK_TIMEOUT_MS).toBe(500);
    });
  });

  describe('URL_INPUT', () => {
    it('should have valid URL input configuration', () => {
      expect(APP_CONFIG.URL_INPUT.DEBOUNCE_MS).toBe(100);
    });
  });

  describe('PROCESS', () => {
    it('should have valid process timeout configuration', () => {
      expect(APP_CONFIG.PROCESS.STREAMLINK_TIMEOUT_MS).toBe(300000); // 5분
      expect(APP_CONFIG.PROCESS.FFMPEG_TIMEOUT_MS).toBe(60000); // 1분
    });
  });

  describe('EXPORT', () => {
    it('should have valid export configuration', () => {
      expect(APP_CONFIG.EXPORT.DEFAULT_BITRATE_KBPS).toBe(2500);
    });
  });

  describe('PROGRESS', () => {
    it('should have valid progress configuration', () => {
      expect(APP_CONFIG.PROGRESS.SEGMENT_MIN_TIME_SEC).toBe(0.5);
      expect(APP_CONFIG.PROGRESS.SEGMENT_MAX_TIME_SEC).toBe(30);
    });
  });

  describe('TIME', () => {
    it('should have valid time conversion constants', () => {
      expect(APP_CONFIG.TIME.SECONDS_PER_MINUTE).toBe(60);
      expect(APP_CONFIG.TIME.SECONDS_PER_HOUR).toBe(3600);
      expect(APP_CONFIG.TIME.MILLISECONDS_PER_SECOND).toBe(1000);
    });

    it('should have correct time conversion relationships', () => {
      const { SECONDS_PER_MINUTE, SECONDS_PER_HOUR } = APP_CONFIG.TIME;
      expect(SECONDS_PER_HOUR).toBe(SECONDS_PER_MINUTE * 60);
    });
  });

  describe('UI', () => {
    it('should have valid UI timing configuration', () => {
      expect(APP_CONFIG.UI.WAVEFORM_INIT_DELAY_MS).toBe(100);
      expect(APP_CONFIG.UI.WAVEFORM_ZOOM_DEBOUNCE_MS).toBe(100);
      expect(APP_CONFIG.UI.TIMELINE_ZOOM_STEP).toBe(0.1);
    });

    it('should have positive delay values', () => {
      expect(APP_CONFIG.UI.WAVEFORM_INIT_DELAY_MS).toBeGreaterThan(0);
      expect(APP_CONFIG.UI.WAVEFORM_ZOOM_DEBOUNCE_MS).toBeGreaterThan(0);
    });
  });

  describe('PLAYBACK', () => {
    it('should have valid playback configuration', () => {
      expect(APP_CONFIG.PLAYBACK.PREVIEW_LONG_SEGMENT_THRESHOLD_SEC).toBe(10);
      expect(APP_CONFIG.PLAYBACK.PREVIEW_EDGE_DURATION_SEC).toBe(5);
    });

    it('should have edge duration less than threshold', () => {
      const { PREVIEW_LONG_SEGMENT_THRESHOLD_SEC, PREVIEW_EDGE_DURATION_SEC } =
        APP_CONFIG.PLAYBACK;
      expect(PREVIEW_EDGE_DURATION_SEC * 2).toBeLessThanOrEqual(
        PREVIEW_LONG_SEGMENT_THRESHOLD_SEC
      );
    });
  });

  describe('POLLING', () => {
    it('should have valid polling configuration', () => {
      expect(APP_CONFIG.POLLING.PROGRESS_CHECK_INTERVAL_MS).toBe(200);
    });

    it('should have reasonable polling interval', () => {
      expect(APP_CONFIG.POLLING.PROGRESS_CHECK_INTERVAL_MS).toBeGreaterThan(0);
      expect(APP_CONFIG.POLLING.PROGRESS_CHECK_INTERVAL_MS).toBeLessThanOrEqual(1000);
    });
  });

  describe('Individual exports', () => {
    it('should export all sections individually', () => {
      const {
        TIMELINE,
        URL_INPUT,
        PROCESS,
        EXPORT,
        PROGRESS,
        TIME,
        UI,
        PLAYBACK,
        POLLING,
      } = APP_CONFIG;

      expect(TIMELINE).toBeDefined();
      expect(URL_INPUT).toBeDefined();
      expect(PROCESS).toBeDefined();
      expect(EXPORT).toBeDefined();
      expect(PROGRESS).toBeDefined();
      expect(TIME).toBeDefined();
      expect(UI).toBeDefined();
      expect(PLAYBACK).toBeDefined();
      expect(POLLING).toBeDefined();
    });
  });
});
