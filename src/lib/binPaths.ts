/**
 * Resolve paths to bundled CLI binaries
 *
 * Priority: bundled binary > system binary
 * - ffmpeg: @ffmpeg-installer/ffmpeg (bundled)
 * - yt-dlp: auto-downloaded to .bin/ (postinstall), system fallback
 * - streamlink: auto-downloaded to .bin/ (postinstall), system fallback
 */

import { execFileSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

let _ffmpegPath: string | null = null;
let _ytdlpPath: string | null = null;
let _streamlinkPath: string | null = null;
let _aria2cPath: string | null | undefined = undefined; // undefined=미탐색, null=없음

/**
 * PATH에 명령이 있는지 확인 (크로스플랫폼).
 * Windows는 `which`가 없으므로 `where`를 쓴다 — 안 그러면 시스템 설치 도구를
 * 항상 못 찾아 번들로만 폴백한다.
 */
function commandExists(cmd: string): boolean {
  try {
    const probe = process.platform === "win32" ? "where" : "which";
    execFileSync(probe, [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * PATH에서 명령의 절대 경로를 해석. 없으면 null.
 * `where`(Windows)는 여러 줄을 낼 수 있어 첫 줄만 취한다.
 */
function resolveCommandPath(cmd: string): string | null {
  try {
    const probe = process.platform === "win32" ? "where" : "which";
    const out = execFileSync(probe, [cmd], { encoding: "utf-8" }).trim();
    const first = out.split(/\r?\n/)[0]?.trim();
    return first || null;
  } catch {
    return null;
  }
}

/**
 * Get ffmpeg binary path
 * Prefers bundled @ffmpeg-installer version
 */
export function getFfmpegPath(): string {
  if (_ffmpegPath) return _ffmpegPath;

  try {
    // Try bundled ffmpeg first
    const installer = require("@ffmpeg-installer/ffmpeg");
    const path: string = installer.path;
    _ffmpegPath = path;
    return path;
  } catch {
    // Fallback to system ffmpeg. 절대 경로로 해석한다 — yt-dlp `--ffmpeg-location`은
    // PATH 탐색이 아닌 실제 경로를 요구하므로 bare 'ffmpeg'는 "does not exist"로 실패한다.
    _ffmpegPath = resolveCommandPath("ffmpeg") || "ffmpeg";
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

  const isWin = process.platform === "win32";
  const root = process.cwd();

  // 1. venv-installed yt-dlp (fast startup, setup-deps가 생성)
  const venvBin = isWin
    ? join(root, ".bin", "yt-dlp-venv", "Scripts", "yt-dlp.exe")
    : join(root, ".bin", "yt-dlp-venv", "bin", "yt-dlp");
  if (existsSync(venvBin)) {
    _ytdlpPath = venvBin;
    return venvBin;
  }

  // 2. System yt-dlp (예: Docker `pip install yt-dlp`) — 역시 모듈이라 빠름
  if (commandExists("yt-dlp")) {
    _ytdlpPath = "yt-dlp";
    return "yt-dlp";
  }

  // 3. Bundled onefile 바이너리 (startup 느림, 최후 fallback)
  const binName = isWin ? "yt-dlp.exe" : "yt-dlp";
  const bundled = join(root, ".bin", binName);
  if (existsSync(bundled)) {
    _ytdlpPath = bundled;
    return bundled;
  }

  // 4. Not found — return literal so ENOENT triggers the user-facing error
  _ytdlpPath = "yt-dlp";
  return "yt-dlp";
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

  if (platform === "win32") {
    bundledPath = join(projectRoot, ".bin", "streamlink-win", "streamlink.exe");
  } else if (platform === "linux") {
    const archSuffix = arch === "arm64" ? "arm64" : "x64";
    bundledPath = join(projectRoot, ".bin", `streamlink-linux-${archSuffix}.AppImage`);
  } else if (platform === "darwin") {
    bundledPath = join(projectRoot, ".bin", "streamlink-venv", "bin", "streamlink");
  }

  if (bundledPath && existsSync(bundledPath)) {
    _streamlinkPath = bundledPath;
    return bundledPath;
  }

  // 2. Check system binary
  if (commandExists("streamlink")) {
    _streamlinkPath = "streamlink";
    return "streamlink";
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
 * Get aria2c binary path
 * Priority: bundled binary (.bin/aria2) > system binary > null
 *
 * yt-dlp의 `--external-downloader`로 넘겨 병렬 다운로드에 쓴다. brew/apt 같은
 * 외부 설치 의존을 없애기 위해 setup-deps가 .bin/aria2에 플랫폼 바이너리를 받아둔다.
 */
export function getAria2cPath(): string | null {
  if (_aria2cPath !== undefined) return _aria2cPath;

  const isWin = process.platform === "win32";
  const bundled = join(process.cwd(), ".bin", "aria2", isWin ? "aria2c.exe" : "aria2c");
  if (existsSync(bundled)) {
    _aria2cPath = bundled;
    return bundled;
  }

  if (commandExists("aria2c")) {
    _aria2cPath = "aria2c";
    return "aria2c";
  }

  _aria2cPath = null;
  return null;
}

/**
 * Check if aria2c is available
 */
export function hasAria2c(): boolean {
  return getAria2cPath() !== null;
}

/**
 * Check which tools are available
 */
export function checkDependencies(): {
  ffmpeg: { available: boolean; path: string; bundled: boolean };
  ytdlp: { available: boolean; path: string };
  streamlink: { available: boolean; path: string; bundled: boolean };
  aria2c: { available: boolean; path: string; bundled: boolean };
} {
  const ffmpegPath = getFfmpegPath();
  let ffmpegAvailable = false;
  let ffmpegBundled = false;
  try {
    execFileSync(ffmpegPath, ["-version"], { stdio: "ignore" });
    ffmpegAvailable = true;
    ffmpegBundled = ffmpegPath !== "ffmpeg";
  } catch {
    /* */
  }

  const ytdlpPath = getYtdlpPath();
  let ytdlpAvailable = false;
  try {
    execFileSync(ytdlpPath, ["--version"], { stdio: "ignore" });
    ytdlpAvailable = true;
  } catch {
    /* */
  }

  const streamlinkPath = getStreamlinkPath();
  const streamlinkAvailable = streamlinkPath !== null;
  const streamlinkBundled = streamlinkPath?.includes(".bin") || false;

  const aria2cPath = getAria2cPath();
  // ffmpeg/yt-dlp와 동일하게 실제 실행 가능 여부까지 확인한다 — 파일만 있고 못 도는
  // 바이너리(arm64 mac의 무서명 SIGKILL, 손상 등)를 "available=true"로 오판하지 않게.
  let aria2cAvailable = false;
  if (aria2cPath) {
    try {
      execFileSync(aria2cPath, ["--version"], { stdio: "ignore" });
      aria2cAvailable = true;
    } catch {
      /* 파일은 있으나 실행 불가 */
    }
  }
  const aria2cBundled = aria2cPath?.includes(".bin") || false;

  return {
    ffmpeg: { available: ffmpegAvailable, path: ffmpegPath, bundled: ffmpegBundled },
    ytdlp: { available: ytdlpAvailable, path: ytdlpPath },
    streamlink: {
      available: streamlinkAvailable,
      path: streamlinkPath || "not found",
      bundled: streamlinkBundled,
    },
    aria2c: { available: aria2cAvailable, path: aria2cPath || "not found", bundled: aria2cBundled },
  };
}
