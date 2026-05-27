/**
 * Resolve paths to bundled CLI binaries (CommonJS version for server.js)
 *
 * Priority: bundled binary > system binary
 * - ffmpeg: @ffmpeg-installer/ffmpeg (bundled)
 * - yt-dlp: auto-downloaded to .bin/ (postinstall), system fallback
 * - streamlink: auto-downloaded to .bin/ (postinstall), system fallback
 */

const { execFileSync } = require('child_process');
const { existsSync } = require('fs');
const { join } = require('path');

let _ffmpegPath = null;
let _ytdlpPath = null;
let _streamlinkPath = null;

/**
 * Get ffmpeg binary path
 * Prefers bundled @ffmpeg-installer version
 */
function getFfmpegPath() {
  if (_ffmpegPath) return _ffmpegPath;

  try {
    // Try bundled ffmpeg first
    const installer = require('@ffmpeg-installer/ffmpeg');
    const path = installer.path;
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
 * Priority: bundled .bin/ > system
 */
function getYtdlpPath() {
  if (_ytdlpPath) return _ytdlpPath;

  // 1. Bundled binary in .bin/
  const binName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const bundled = join(process.cwd(), '.bin', binName);
  if (existsSync(bundled)) {
    _ytdlpPath = bundled;
    return bundled;
  }

  // 2. System fallback
  try {
    execFileSync('which', ['yt-dlp'], { stdio: 'ignore' });
    _ytdlpPath = 'yt-dlp';
    return 'yt-dlp';
  } catch {
    _ytdlpPath = 'yt-dlp';
    return 'yt-dlp';
  }
}

/**
 * Get streamlink binary path
 * Priority: bundled binary > system binary
 */
function getStreamlinkPath() {
  if (_streamlinkPath) return _streamlinkPath;

  const platform = process.platform;

  // macOS: system only (no bundled binary)
  if (platform === 'darwin') {
    try {
      execFileSync('which', ['streamlink'], { stdio: 'ignore' });
      _streamlinkPath = 'streamlink';
      return 'streamlink';
    } catch {
      console.warn('[binPaths] streamlink not found. Install with: brew install streamlink');
      return null;
    }
  }

  // Windows: portable .exe
  if (platform === 'win32') {
    const binPath = join(process.cwd(), '.bin', 'streamlink', 'streamlink.exe');
    if (existsSync(binPath)) {
      _streamlinkPath = binPath;
      return binPath;
    }
  }

  // Linux: AppImage
  if (platform === 'linux') {
    const binPath = join(process.cwd(), '.bin', 'streamlink.AppImage');
    if (existsSync(binPath)) {
      _streamlinkPath = binPath;
      return binPath;
    }
  }

  // Fallback: system streamlink
  try {
    execFileSync('which', ['streamlink'], { stdio: 'ignore' });
    _streamlinkPath = 'streamlink';
    return 'streamlink';
  } catch {
    console.warn('[binPaths] streamlink not found');
    return null;
  }
}

/**
 * Check if streamlink is available
 */
function hasStreamlink() {
  return getStreamlinkPath() !== null;
}

module.exports = {
  getFfmpegPath,
  getYtdlpPath,
  getStreamlinkPath,
  hasStreamlink,
};
