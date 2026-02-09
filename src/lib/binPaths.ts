/**
 * Resolve paths to bundled CLI binaries
 *
 * Priority: bundled binary > system binary
 * - ffmpeg: @ffmpeg-installer/ffmpeg (bundled)
 * - yt-dlp: yt-dlp-wrap downloads binary on first use
 * - streamlink: system only (pip install)
 */

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

let _ffmpegPath: string | null = null;
let _ytdlpPath: string | null = null;

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
 * Check if streamlink is available
 */
export function hasStreamlink(): boolean {
  try {
    execFileSync('which', ['streamlink'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check which tools are available
 */
export function checkDependencies(): {
  ffmpeg: { available: boolean; path: string; bundled: boolean };
  ytdlp: { available: boolean; path: string };
  streamlink: { available: boolean };
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

  return {
    ffmpeg: { available: ffmpegAvailable, path: ffmpegPath, bundled: ffmpegBundled },
    ytdlp: { available: ytdlpAvailable, path: ytdlpPath },
    streamlink: { available: hasStreamlink() },
  };
}
