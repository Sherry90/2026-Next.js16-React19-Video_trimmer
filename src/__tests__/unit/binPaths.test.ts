import { describe, it, expect } from 'vitest';
import {
  checkDependencies,
  getFfmpegPath,
  getYtdlpPath,
  getStreamlinkPath,
  hasStreamlink,
} from '@/lib/binPaths';

describe('binPaths - Dependency Installation Verification', () => {
  describe('Critical Dependencies - Build must fail if missing', () => {
    it('ffmpeg must be installed and executable', () => {
      const deps = checkDependencies();

      expect(
        deps.ffmpeg.available,
        `❌ CRITICAL: ffmpeg not found or not executable.\n` +
          `   Path checked: ${deps.ffmpeg.path}\n` +
          `   This is a bundled dependency - if missing, run: npm install`
      ).toBe(true);

      expect(
        deps.ffmpeg.bundled,
        `⚠️  ffmpeg found but not using bundled version.\n` +
          `   Expected: bundled via @ffmpeg-installer/ffmpeg\n` +
          `   Actual: system ffmpeg at ${deps.ffmpeg.path}`
      ).toBe(true);
    });

    it('yt-dlp must be installed and executable', () => {
      const deps = checkDependencies();

      expect(
        deps.ytdlp.available,
        `❌ CRITICAL: yt-dlp not found or not executable.\n` +
          `   Path checked: ${deps.ytdlp.path}\n` +
          `   Resolution:\n` +
          `   1. Run: npm install (triggers postinstall script)\n` +
          `   2. Or install system-wide: brew install yt-dlp\n` +
          `   3. Check if .bin/yt-dlp exists and is executable`
      ).toBe(true);
    });

    it('streamlink must be installed and executable', () => {
      const deps = checkDependencies();
      const platform = process.platform;

      let errorMessage = `❌ CRITICAL: streamlink not found or not executable.\n` +
        `   Path checked: ${deps.streamlink.path}\n`;

      if (platform === 'darwin') {
        errorMessage +=
          `   macOS Resolution:\n` +
          `   - streamlink is NOT auto-downloaded on macOS\n` +
          `   - Install manually: brew install streamlink\n` +
          `   - This is required for URL-based video trimming`;
      } else if (platform === 'win32') {
        errorMessage +=
          `   Windows Resolution:\n` +
          `   1. Run: npm install (should auto-download to .bin/)\n` +
          `   2. Check if .bin/streamlink-win/streamlink.exe exists\n` +
          `   3. If missing, check scripts/setup-deps.mjs logs`;
      } else if (platform === 'linux') {
        const arch = process.arch;
        const expectedArch = arch === 'arm64' ? 'arm64' : 'x64';
        errorMessage +=
          `   Linux Resolution:\n` +
          `   1. Run: npm install (should auto-download AppImage)\n` +
          `   2. Check if .bin/streamlink-linux-${expectedArch}.AppImage exists\n` +
          `   3. Ensure file has execute permissions\n` +
          `   4. If missing, check scripts/setup-deps.mjs logs`;
      }

      expect(deps.streamlink.available, errorMessage).toBe(true);
    });
  });

  describe('Bundling Strategy Verification', () => {
    it('should prefer bundled ffmpeg over system ffmpeg', () => {
      const deps = checkDependencies();

      if (deps.ffmpeg.available) {
        expect(deps.ffmpeg.bundled).toBe(true);
      }
    });

    it('should prefer bundled streamlink on Windows/Linux', () => {
      const deps = checkDependencies();
      const platform = process.platform;

      // macOS는 시스템 설치만 지원, Windows/Linux는 번들 우선
      if (deps.streamlink.available && platform !== 'darwin') {
        expect(
          deps.streamlink.bundled,
          `streamlink should use bundled binary on ${platform}, but using system binary.\n` +
            `This may cause version inconsistencies.`
        ).toBe(true);
      }
    });

    it('yt-dlp should use system > .bin > yt-dlp-wrap (in priority order)', () => {
      const ytdlpPath = getYtdlpPath();

      // 경로가 있어야 함
      expect(ytdlpPath).toBeTruthy();

      // 시스템 또는 .bin 또는 yt-dlp-wrap 경로여야 함
      const isValid =
        ytdlpPath === 'yt-dlp' || // system
        ytdlpPath.includes('.bin/yt-dlp') || // local download
        ytdlpPath.includes('node_modules'); // yt-dlp-wrap

      expect(
        isValid,
        `yt-dlp path is unexpected: ${ytdlpPath}`
      ).toBe(true);
    });
  });

  describe('Path Resolution Functions', () => {
    it('getFfmpegPath should return valid path', () => {
      const path = getFfmpegPath();
      expect(path).toBeTruthy();
      expect(typeof path).toBe('string');
    });

    it('getYtdlpPath should return valid path', () => {
      const path = getYtdlpPath();
      expect(path).toBeTruthy();
      expect(typeof path).toBe('string');
    });

    it('getStreamlinkPath should return valid path or null', () => {
      const path = getStreamlinkPath();
      expect(path === null || typeof path === 'string').toBe(true);
    });

    it('hasStreamlink should match getStreamlinkPath result', () => {
      const path = getStreamlinkPath();
      const hasIt = hasStreamlink();

      if (path === null) {
        expect(hasIt).toBe(false);
      } else {
        expect(hasIt).toBe(true);
      }
    });
  });

  describe('Deployment Readiness Check', () => {
    it('ALL dependencies must be ready for production deployment', () => {
      const deps = checkDependencies();

      const missing: string[] = [];
      if (!deps.ffmpeg.available) missing.push('ffmpeg');
      if (!deps.ytdlp.available) missing.push('yt-dlp');
      if (!deps.streamlink.available) missing.push('streamlink');

      expect(
        missing.length === 0,
        `❌ DEPLOYMENT BLOCKED: Missing dependencies: ${missing.join(', ')}\n\n` +
          `This application cannot be deployed without all required binaries.\n` +
          `Run 'npm install' to ensure postinstall scripts execute correctly.\n\n` +
          `Current status:\n` +
          `  - ffmpeg: ${deps.ffmpeg.available ? '✅' : '❌'} (${deps.ffmpeg.path})\n` +
          `  - yt-dlp: ${deps.ytdlp.available ? '✅' : '❌'} (${deps.ytdlp.path})\n` +
          `  - streamlink: ${deps.streamlink.available ? '✅' : '❌'} (${deps.streamlink.path})\n`
      ).toBe(true);
    });
  });
});
