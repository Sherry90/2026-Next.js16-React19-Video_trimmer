import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from '@/constants/appConfig';

describe('APP_CONFIG', () => {
  it('should have all required sections', () => {
    expect(APP_CONFIG.TIMELINE).toBeDefined();
    expect(APP_CONFIG.URL_INPUT).toBeDefined();
    expect(APP_CONFIG.PROCESS).toBeDefined();
    expect(APP_CONFIG.EXPORT).toBeDefined();
    expect(APP_CONFIG.PROGRESS).toBeDefined();
    expect(APP_CONFIG.TIME).toBeDefined();
    expect(APP_CONFIG.UI).toBeDefined();
    expect(APP_CONFIG.PLAYBACK).toBeDefined();
    expect(APP_CONFIG.POLLING).toBeDefined();
  });

  it('should have valid time conversion constants', () => {
    expect(APP_CONFIG.TIME.SECONDS_PER_MINUTE).toBe(60);
    expect(APP_CONFIG.TIME.SECONDS_PER_HOUR).toBe(3600);
  });

  it('should have valid process timeouts', () => {
    expect(APP_CONFIG.PROCESS.STREAMLINK_TIMEOUT_MS).toBeGreaterThan(0);
    expect(APP_CONFIG.PROCESS.FFMPEG_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
