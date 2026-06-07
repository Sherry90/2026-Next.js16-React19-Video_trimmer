/**
 * Resolve paths to bundled CLI binaries
 *
 * Priority: bundled binary > system binary
 * - ffmpeg: @ffmpeg-installer/ffmpeg (bundled)
 * - yt-dlp: auto-downloaded to .bin/ (postinstall), system fallback
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
    // Fallback to system ffmpeg. 절대 경로로 해석한다 — yt-dlp `--ffmpeg-location`은
    // PATH 탐색이 아닌 실제 경로를 요구하므로 bare 'ffmpeg'는 "does not exist"로 실패한다.
    try {
      const resolved = execFileSync('which', ['ffmpeg'], { encoding: 'utf-8' }).trim();
      _ffmpegPath = resolved || 'ffmpeg';
    } catch {
      _ffmpegPath = 'ffmpeg';
    }
    return _ffmpegPath;
  }
}

/**
 * Get yt-dlp binary path
 * Priority: venv (pip) > system > bundled onefile binary
 *
 * 순서가 성능에 직결된다. PyInstaller onefile 바이너리(`.bin/yt-dlp`)는 매 호출마다
 * Python 런타임을 self-extract → macOS에서 startup ~9초. venv/system yt-dlp는 Python
 * 모듈이라 startup ~0.1초. 따라서 venv·system을 우선하고 onefile은 최후 fallback.
 */
export function getYtdlpPath(): string {
  if (_ytdlpPath) return _ytdlpPath;

  const isWin = process.platform === 'win32';
  const root = process.cwd();

  // 1. venv-installed yt-dlp (fast startup, setup-deps가 생성)
  const venvBin = isWin
    ? join(root, '.bin', 'yt-dlp-venv', 'Scripts', 'yt-dlp.exe')
    : join(root, '.bin', 'yt-dlp-venv', 'bin', 'yt-dlp');
  if (existsSync(venvBin)) {
    _ytdlpPath = venvBin;
    return venvBin;
  }

  // 2. System yt-dlp (예: Docker `pip install yt-dlp`) — 역시 모듈이라 빠름
  try {
    execFileSync('which', ['yt-dlp'], { stdio: 'ignore' });
    _ytdlpPath = 'yt-dlp';
    return 'yt-dlp';
  } catch {
    // not found — 다음 단계로
  }

  // 3. Bundled onefile 바이너리 (startup 느림, 최후 fallback)
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const bundled = join(root, '.bin', binName);
  if (existsSync(bundled)) {
    _ytdlpPath = bundled;
    return bundled;
  }

  // 4. Not found — return literal so ENOENT triggers the user-facing error
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
    bundledPath = join(projectRoot, '.bin', 'streamlink-venv', 'bin', 'streamlink');
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
