#!/usr/bin/env node
/**
 * Post-install script: downloads yt-dlp and streamlink binaries if not already available on the system.
 * ffmpeg is bundled via @ffmpeg-installer/ffmpeg (no download needed).
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, createWriteStream, copyFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import https from 'https';
import { pipeline } from 'stream/promises';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');
const binDir = join(projectRoot, '.bin');

function hasCommand(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Download file from URL
 */
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Video-Trimmer' },
    }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const fileStream = createWriteStream(dest);
      pipeline(res, fileStream)
        .then(resolve)
        .catch(reject);
    }).on('error', reject);
  });
}

/**
 * Download and extract ZIP file (Windows)
 */
async function downloadAndExtract(url, destDir) {
  const AdmZip = (await import('adm-zip')).default;
  const tmpZip = join(binDir, 'temp-streamlink.zip');

  try {
    await downloadFile(url, tmpZip);
    const zip = new AdmZip(tmpZip);
    zip.extractAllTo(destDir, true);
  } finally {
    if (existsSync(tmpZip)) {
      unlinkSync(tmpZip);
    }
  }
}

/**
 * Get streamlink binary path for current platform
 */
function getStreamlinkBinPath() {
  const { platform, arch } = process;

  if (platform === 'win32') {
    return join(binDir, 'streamlink-win', 'streamlink.exe');
  } else if (platform === 'linux') {
    const archSuffix = arch === 'arm64' ? 'arm64' : 'x64';
    return join(binDir, `streamlink-linux-${archSuffix}.AppImage`);
  } else if (platform === 'darwin') {
    return join(binDir, 'streamlink-venv', 'bin', 'streamlink');
  }
  return null;
}

async function setupYtDlp() {
  // Check if yt-dlp is already available on the system
  if (hasCommand('yt-dlp')) {
    try {
      const version = execFileSync('yt-dlp', ['--version'], { encoding: 'utf-8' }).trim();
      console.log(`  yt-dlp: v${version} (system)`);
    } catch {
      console.log('  yt-dlp: found (system)');
    }
    return;
  }

  // Check if already downloaded to .bin/
  const ytdlpBinPath = join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (existsSync(ytdlpBinPath)) {
    console.log(`  yt-dlp: found (.bin/yt-dlp)`);
    return;
  }

  // Download via yt-dlp-wrap
  console.log('  yt-dlp: not found, downloading...');
  try {
    const { default: YTDlpWrap } = await import('yt-dlp-wrap');
    if (!existsSync(binDir)) {
      mkdirSync(binDir, { recursive: true });
    }
    await YTDlpWrap.downloadFromGithub(ytdlpBinPath);
    console.log(`  yt-dlp: downloaded to .bin/yt-dlp`);
  } catch (error) {
    console.warn(`  yt-dlp: download failed - ${error.message}`);
    console.warn('          manual install: https://github.com/yt-dlp/yt-dlp#installation');
  }
}

/**
 * Download streamlink binary for current platform
 */
async function downloadStreamlink() {
  const { platform, arch } = process;
  const version = '8.2.0-1';

  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  if (platform === 'win32') {
    // Windows portable .zip download
    const url = `https://github.com/streamlink/windows-builds/releases/download/${version}/streamlink-${version}-py314-x86_64.zip`;
    console.log(`    Downloading from ${url}`);
    await downloadAndExtract(url, join(binDir, 'streamlink-win'));
  } else if (platform === 'linux') {
    // Linux AppImage download
    const archSuffix = arch === 'arm64' ? 'aarch64' : 'x86_64';
    const url = `https://github.com/streamlink/streamlink-appimage/releases/download/${version}/streamlink-${version}-cp314-cp314-manylinux_2_28_${archSuffix}.AppImage`;
    const destPath = join(binDir, `streamlink-linux-${arch === 'arm64' ? 'arm64' : 'x64'}.AppImage`);
    console.log(`    Downloading from ${url}`);
    await downloadFile(url, destPath);
    execFileSync('chmod', ['+x', destPath]);
  } else if (platform === 'darwin') {
    // macOS: install via Python venv (Python 3 is built-in since macOS 12.3)
    const venvDir = join(binDir, 'streamlink-venv');
    console.log('    Installing streamlink via Python venv...');
    execFileSync('python3', ['-m', 'venv', venvDir], { stdio: 'inherit' });
    execFileSync(join(venvDir, 'bin', 'pip'), ['install', 'streamlink', '--quiet'], { stdio: 'inherit' });
    console.log(`    Installed to ${venvDir}`);
  }
}

/**
 * Setup streamlink binary
 * Priority: system > bundled binary (auto-download)
 */
async function setupStreamlink() {
  // 1. Check system streamlink
  if (hasCommand('streamlink')) {
    try {
      const version = execFileSync('streamlink', ['--version'], { encoding: 'utf-8' }).trim();
      console.log(`  streamlink: ${version} (system)`);
    } catch {
      console.log('  streamlink: found (system)');
    }
    return;
  }

  // 2. Check bundled binary
  const binPath = getStreamlinkBinPath();
  if (binPath && existsSync(binPath)) {
    const filename = join('.bin', binPath.split('.bin/')[1] || 'streamlink');
    console.log(`  streamlink: found (${filename})`);
    return;
  }

  // 3. Download
  console.log('  streamlink: not found, downloading...');
  try {
    await downloadStreamlink();
    console.log('  streamlink: downloaded successfully');
  } catch (error) {
    console.warn(`  streamlink: download failed - ${error.message}`);
    console.warn('          HLS trimming will be unavailable');
    console.warn('          Install manually: https://streamlink.github.io/install.html');
  }
}

/**
 * Copy FFmpeg.wasm files from node_modules to public/ffmpeg/
 */
function copyWasmFiles() {
  const srcDir = join(projectRoot, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
  const destDir = join(projectRoot, 'public', 'ffmpeg');
  const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

  if (!existsSync(srcDir)) {
    console.warn('  ffmpeg-wasm: @ffmpeg/core not installed, skipping copy');
    return;
  }

  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  let copied = 0;
  for (const file of files) {
    const src = join(srcDir, file);
    const dest = join(destDir, file);
    if (existsSync(src) && !existsSync(dest)) {
      copyFileSync(src, dest);
      copied++;
    }
  }

  if (copied > 0) {
    console.log(`  ffmpeg-wasm: copied ${copied} file(s) to public/ffmpeg/`);
  } else {
    console.log('  ffmpeg-wasm: already up to date (public/ffmpeg/)');
  }
}

function checkFfmpeg() {
  try {
    const installer = require('@ffmpeg-installer/ffmpeg');
    if (existsSync(installer.path)) {
      console.log(`  ffmpeg: v${installer.version} (bundled)`);
      return;
    }
  } catch {
    // ignore
  }

  if (hasCommand('ffmpeg')) {
    console.log('  ffmpeg: found (system)');
  } else {
    console.warn('  ffmpeg: NOT FOUND - install with: brew install ffmpeg');
  }
}

console.log('\nVideo Trimmer - Dependencies\n');
checkFfmpeg();
await setupYtDlp();
await setupStreamlink();
copyWasmFiles();
console.log('');
