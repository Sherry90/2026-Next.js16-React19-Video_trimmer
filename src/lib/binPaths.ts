/**
 * Resolve paths to bundled CLI binaries
 *
 * Priority: bundled binary > system binary
 * - ffmpeg: @ffmpeg-installer/ffmpeg (bundled)
 * - yt-dlp: yt-dlp-wrap downloads binary on first use
 * - streamlink: auto-downloaded to .bin/ (postinstall), system fallback
 */

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

let _ffmpegPath: string | null = null;
let _ytdlpPath: string | null = null;
let _streamlinkPath: string | null = null;

/**
 * Get ffmpeg binary path
 * Prefers bundled @ffmpeg-installer version
 */
export function getFfmpegPath(): string {
  if (_ffmpegPath) return _ffmpegPath;

  try {
    // Try bundled ffmpeg first
    const installer = require('@ffmpeg-installer/ffmpeg');
    const path: string = installer.path;
    _ffmpegPath = path;
    return path;
  } catch {
    // Fallback to system ffmpeg
    _ffmpegPath = 'ffmpeg';
    return 'ffmpeg';
  }
}

/**
 * Get yt-dlp binary path
 * Tries bundled (via yt-dlp-wrap download), then system
 */
export function getYtdlpPath(): string {
  if (_ytdlpPath) return _ytdlpPath;

  // Try system yt-dlp first (more up-to-date usually)
  try {
    execFileSync('which', ['yt-dlp'], { stdio: 'ignore' });
    _ytdlpPath = 'yt-dlp';
    return 'yt-dlp';
  } catch {
    // Will try yt-dlp-wrap path
  }

  // Try .bin/yt-dlp (downloaded by setup-deps script)
  const localBin = join(process.cwd(), '.bin', 'yt-dlp');
  if (existsSync(localBin)) {
    _ytdlpPath = localBin;
    return localBin;
  }

  // Try yt-dlp-wrap bundled binary
  try {
    const YTDlpWrap = require('yt-dlp-wrap').default;
    const path: string | undefined = YTDlpWrap.getDefaultBinaryPath?.();
    if (path) {
      _ytdlpPath = path;
      return path;
    }
  } catch {
    // ignore
  }

  _ytdlpPath = 'yt-dlp';
  return 'yt-dlp';
}

/**
 * Get streamlink binary path
 * Priority: bundled binary > system binary
 */
export function getStreamlinkPath(): string | null {
  if (_streamlinkPath) return _streamlinkPath;

  const platform = process.platform;
  const arch = process.arch;
  const projectRoot = process.cwd();

  // 1. Check bundled binary
  let bundledPath: string | undefined;

  if (platform === 'win32') {
    bundledPath = join(projectRoot, '.bin', 'streamlink-win', 'streamlink.exe');
  } else if (platform === 'linux') {
    const archSuffix = arch === 'arm64' ? 'arm64' : 'x64';
    bundledPath = join(projectRoot, '.bin', `streamlink-linux-${archSuffix}.AppImage`);
  } else if (platform === 'darwin') {
    bundledPath = join(projectRoot, '.bin', 'streamlink-macos');
  }

  if (bundledPath && existsSync(bundledPath)) {
    _streamlinkPath = bundledPath;
    return bundledPath;
  }

  // 2. Check system binary
  try {
    execFileSync('which', ['streamlink'], { stdio: 'ignore' });
    _streamlinkPath = 'streamlink';
    return 'streamlink';
  } catch {
    // Not found
  }

  return null;
}

/**
 * Check if streamlink is available
 */
export function hasStreamlink(): boolean {
  return getStreamlinkPath() !== null;
}

/**
 * Check which tools are available
 */
export function checkDependencies(): {
  ffmpeg: { available: boolean; path: string; bundled: boolean };
  ytdlp: { available: boolean; path: string };
  streamlink: { available: boolean; path: string; bundled: boolean };
} {
  const ffmpegPath = getFfmpegPath();
  let ffmpegAvailable = false;
  let ffmpegBundled = false;
  try {
    execFileSync(ffmpegPath, ['-version'], { stdio: 'ignore' });
    ffmpegAvailable = true;
    ffmpegBundled = ffmpegPath !== 'ffmpeg';
  } catch { /* */ }

  const ytdlpPath = getYtdlpPath();
  let ytdlpAvailable = false;
  try {
    execFileSync(ytdlpPath, ['--version'], { stdio: 'ignore' });
    ytdlpAvailable = true;
  } catch { /* */ }

  const streamlinkPath = getStreamlinkPath();
  const streamlinkAvailable = streamlinkPath !== null;
  const streamlinkBundled = streamlinkPath?.includes('.bin') || false;

  return {
    ffmpeg: { available: ffmpegAvailable, path: ffmpegPath, bundled: ffmpegBundled },
    ytdlp: { available: ytdlpAvailable, path: ytdlpPath },
    streamlink: { available: streamlinkAvailable, path: streamlinkPath || 'not found', bundled: streamlinkBundled },
  };
}
