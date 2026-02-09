#!/usr/bin/env node
/**
 * Post-install script: downloads yt-dlp binary if not already available on the system.
 * ffmpeg is bundled via @ffmpeg-installer/ffmpeg (no download needed).
 * streamlink is optional (system-only, pip install).
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

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

function checkStreamlink() {
  if (hasCommand('streamlink')) {
    console.log('  streamlink: found (system, optional)');
  } else {
    console.log('  streamlink: not found (optional, for Chzzk etc.)');
  }
}

console.log('\nVideo Trimmer - Dependencies\n');
checkFfmpeg();
await setupYtDlp();
checkStreamlink();
console.log('');
