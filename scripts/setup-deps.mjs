#!/usr/bin/env node
/**
 * Post-install script: downloads yt-dlp and streamlink binaries if not already available on the system.
 * ffmpeg is bundled via @ffmpeg-installer/ffmpeg (no download needed).
 */

import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, createWriteStream, copyFileSync, unlinkSync, rmSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import https from 'https';
import { pipeline } from 'stream/promises';

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');
const binDir = join(projectRoot, '.bin');
const skipOptionalBinaryDownloads =
  process.env.SKIP_OPTIONAL_BINARY_DOWNLOADS === '1' ||
  process.env.SKIP_OPTIONAL_BINARY_DOWNLOADS === 'true';
const downloadTimeoutMs = Number.parseInt(
  process.env.SETUP_DEPS_DOWNLOAD_TIMEOUT_MS || '45000',
  10,
);
const childProcessTimeoutMs = Number.parseInt(
  process.env.SETUP_DEPS_CHILD_TIMEOUT_MS || '300000',
  10,
);

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
    const request = https.get(url, {
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
    });

    request.setTimeout(downloadTimeoutMs, () => {
      request.destroy(new Error(`Download timed out after ${downloadTimeoutMs}ms`));
    });

    request.on('error', reject);
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

/**
 * Resolve yt-dlp GitHub release asset name for current platform
 */
function getYtdlpAssetName() {
  const { platform, arch } = process;
  if (platform === 'win32') return 'yt-dlp.exe';
  if (platform === 'darwin') return 'yt-dlp_macos';
  if (platform === 'linux') {
    return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  }
  throw new Error(`Unsupported platform for yt-dlp bundling: ${platform} ${arch}`);
}

/**
 * venv-installed yt-dlp 실행 파일 경로 (플랫폼별)
 */
function getYtdlpVenvBinPath() {
  const venvDir = join(binDir, 'yt-dlp-venv');
  return process.platform === 'win32'
    ? join(venvDir, 'Scripts', 'yt-dlp.exe')
    : join(venvDir, 'bin', 'yt-dlp');
}

/**
 * 프로젝트가 소유하는 단일 고정 Python (시스템 Python 미사용 → 버전 통일).
 *
 * python-build-standalone(astral-sh)의 한 버전을 핀으로 고정한다. 여러 시스템 Python
 * 버전을 대응하지 않고 모든 환경에서 동일한 인터프리터를 쓴다. GitHub release 에셋은
 * Fastly CDN으로 서빙된다. 갱신 시 version/release 두 값만 바꾸면 됨.
 */
const BUNDLED_PYTHON = {
  version: '3.13.13',
  release: '20260510',
};

/**
 * python-build-standalone 플랫폼 triple.
 */
function getPythonTriple() {
  const { platform, arch } = process;
  const a = arch === 'arm64' ? 'aarch64' : 'x86_64';
  if (platform === 'darwin') return `${a}-apple-darwin`;
  if (platform === 'linux') return `${a}-unknown-linux-gnu`;
  if (platform === 'win32') return `${a}-pc-windows-msvc`;
  return null;
}

/**
 * 고정 Python install_only 에셋 URL (핀된 version/release로 직접 구성).
 */
function pythonStandaloneUrl() {
  const triple = getPythonTriple();
  if (!triple) return null;
  const { version, release } = BUNDLED_PYTHON;
  // URL의 `+`는 `%2B`로 인코딩 (GitHub canonical)
  return `https://github.com/astral-sh/python-build-standalone/releases/download/${release}/cpython-${version}%2B${release}-${triple}-install_only.tar.gz`;
}

/**
 * 프로젝트 내 번들 Python 실행 파일 경로(.bin/python).
 */
function getBundledPythonBinPath() {
  const pyDir = join(binDir, 'python');
  return process.platform === 'win32'
    ? join(pyDir, 'python.exe')
    : join(pyDir, 'bin', 'python3');
}

/**
 * 기존 venv가 **번들 Python(.bin/python)** 으로 만들어졌는지 확인.
 * pyvenv.cfg의 home이 .bin/python 하위가 아니면(예: 과거 시스템 Python으로 생성) 재생성 대상.
 *
 * @param venvName .bin 하위 venv 디렉터리명 (예: 'yt-dlp-venv', 'streamlink-venv')
 */
function venvUsesBundledPython(venvName) {
  const cfg = join(binDir, venvName, 'pyvenv.cfg');
  if (!existsSync(cfg)) return false;
  try {
    const m = readFileSync(cfg, 'utf-8').match(/^home\s*=\s*(.+)$/m);
    if (!m) return false;
    return m[1].trim().startsWith(join(binDir, 'python'));
  } catch {
    return false;
  }
}

/**
 * 프로젝트 내장 Python을 .bin/python에 설치(시스템 Python 의존 제거, 단일 고정 버전).
 *
 * 사용자가 PC에 Python을 별도 설치하지 않아도 프로젝트 바이너리만으로 동작하게 한다
 * (ffmpeg/yt-dlp/streamlink 번들과 동일 철학). install_only 빌드(~25MB)만 받아 최소화.
 * tar는 macOS/Linux/Win10+ 기본 제공. 성공 시 python 실행 경로 반환, 실패 시 null.
 */
async function setupBundledPython() {
  const url = pythonStandaloneUrl();
  if (!url) {
    console.warn('  python: no standalone build for this platform');
    return null;
  }

  const pyBin = getBundledPythonBinPath();
  if (existsSync(pyBin)) {
    try {
      const v = execFileSync(pyBin, ['--version'], { encoding: 'utf-8' }).trim();
      console.log(`  python: ${v} (.bin/python, bundled)`);
    } catch {
      console.log('  python: found (.bin/python, bundled)');
    }
    return pyBin;
  }

  try {
    if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
    const tgz = join(binDir, 'python-standalone.tar.gz');
    console.log(`  python: downloading bundled CPython ${BUNDLED_PYTHON.version} (no system Python required)...`);
    console.log(`    ${url}`);
    await downloadFile(url, tgz);
    // tarball은 "python/" 루트로 풀린다 → .bin/python/
    execFileSync('tar', ['-xzf', tgz, '-C', binDir], { timeout: childProcessTimeoutMs });
    if (existsSync(tgz)) unlinkSync(tgz);
    if (!existsSync(pyBin)) {
      console.warn('  python: extract did not produce expected interpreter');
      return null;
    }
    const v = execFileSync(pyBin, ['--version'], { encoding: 'utf-8' }).trim();
    console.log(`  python: ${v} (.bin/python, bundled)`);
    return pyBin;
  } catch (e) {
    console.warn(`  python: bundled setup failed - ${e.message}`);
    return null;
  }
}

/**
 * yt-dlp를 **번들 Python venv** 에 pip 설치 (startup ~0.1초, 단일 고정 Python).
 *
 * 항상 프로젝트 내장 Python(.bin/python)으로 venv를 만든다 → 환경마다 Python 버전이
 * 달라지는 문제 제거. 번들 Python 확보 실패 시 false → onefile 바이너리로 폴백.
 */
async function setupYtDlpVenv() {
  const python = await setupBundledPython();
  if (!python) {
    console.warn('  yt-dlp: bundled Python unavailable → onefile 바이너리로 폴백');
    return false;
  }

  const venvDir = join(binDir, 'yt-dlp-venv');
  const pipBin = process.platform === 'win32'
    ? join(venvDir, 'Scripts', 'pip.exe')
    : join(venvDir, 'bin', 'pip');

  try {
    if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true });
    console.log(`  yt-dlp: installing via Python venv (${python}, fast startup)...`);
    execFileSync(python, ['-m', 'venv', venvDir], {
      stdio: 'inherit',
      timeout: childProcessTimeoutMs,
    });
    // yt-dlp는 YouTube 변경으로 자주 깨지므로 unpinned(최신) 설치 (Dockerfile과 동일 정책)
    execFileSync(pipBin, ['install', '--quiet', '--upgrade', 'yt-dlp'], {
      stdio: 'inherit',
      timeout: childProcessTimeoutMs,
    });
    const version = execFileSync(getYtdlpVenvBinPath(), ['--version'], { encoding: 'utf-8' }).trim();
    console.log(`  yt-dlp: v${version} (.bin/yt-dlp-venv)`);
    return true;
  } catch (error) {
    console.warn(`  yt-dlp: venv install failed - ${error.message}`);
    console.warn('          falling back to onefile binary (slower startup)');
    return false;
  }
}

async function setupYtDlp() {
  // 1. System yt-dlp (예: Docker `pip install yt-dlp`) — 모듈이라 빠름, 그대로 사용
  if (hasCommand('yt-dlp')) {
    try {
      const version = execFileSync('yt-dlp', ['--version'], { encoding: 'utf-8' }).trim();
      console.log(`  yt-dlp: v${version} (system)`);
    } catch {
      console.log('  yt-dlp: found (system)');
    }
    return;
  }

  // 2. venv yt-dlp 이미 설치됨 — 단, 번들 Python(.bin/python)으로 만든 것만 유효
  //    (과거 시스템 Python으로 만든 venv는 버전 통일/재현성 위해 재생성)
  if (existsSync(getYtdlpVenvBinPath())) {
    if (venvUsesBundledPython('yt-dlp-venv')) {
      try {
        const version = execFileSync(getYtdlpVenvBinPath(), ['--version'], { encoding: 'utf-8' }).trim();
        console.log(`  yt-dlp: v${version} (.bin/yt-dlp-venv, bundled Python)`);
      } catch {
        console.log('  yt-dlp: found (.bin/yt-dlp-venv)');
      }
      return;
    }
    console.log('  yt-dlp: 기존 venv가 번들 Python 미사용 → 재생성 (버전 통일)');
    rmSync(join(binDir, 'yt-dlp-venv'), { recursive: true, force: true });
  }

  // 3. venv 설치 시도 (시스템 3.10+ 또는 번들 Python, onefile 대비 startup ~90배 빠름)
  if (await setupYtDlpVenv()) return;

  // 4. Fallback: onefile 바이너리 다운로드 (startup 느림, venv 불가 환경용)
  const ytdlpBinPath = join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (existsSync(ytdlpBinPath)) {
    try {
      const version = execFileSync(ytdlpBinPath, ['--version'], { encoding: 'utf-8' }).trim();
      console.log(`  yt-dlp: v${version} (.bin/, onefile fallback)`);
    } catch {
      console.log('  yt-dlp: found (.bin/, onefile fallback)');
    }
    return;
  }

  const version = '2026.03.17';
  const asset = getYtdlpAssetName();
  const url = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}/${asset}`;

  console.log('  yt-dlp: not found, downloading onefile binary...');
  console.log(`    Downloading from ${url}`);

  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  await downloadFile(url, ytdlpBinPath);

  // Make executable on Unix-like systems
  if (process.platform !== 'win32') {
    execFileSync('chmod', ['+x', ytdlpBinPath], { timeout: childProcessTimeoutMs });
  }

  console.log(`  yt-dlp: downloaded to .bin/${process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'}`);
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
    execFileSync('chmod', ['+x', destPath], { timeout: childProcessTimeoutMs });
  } else if (platform === 'darwin') {
    // macOS: 프로젝트 번들 Python으로 venv 생성 (yt-dlp와 동일한 단일 고정 Python → 버전 통일)
    const python = await setupBundledPython();
    if (!python) {
      throw new Error('번들 Python 확보 실패 (streamlink venv 생성 불가)');
    }
    const venvDir = join(binDir, 'streamlink-venv');
    console.log('    Installing streamlink via bundled Python venv...');
    execFileSync(python, ['-m', 'venv', venvDir], {
      stdio: 'inherit',
      timeout: childProcessTimeoutMs,
    });
    execFileSync(join(venvDir, 'bin', 'pip'), ['install', 'streamlink', '--quiet'], {
      stdio: 'inherit',
      timeout: childProcessTimeoutMs,
    });
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
    // macOS venv는 번들 Python으로 만든 것만 유효 (버전 통일). 아니면 재생성.
    if (process.platform === 'darwin' && !venvUsesBundledPython('streamlink-venv')) {
      console.log('  streamlink: 기존 venv가 번들 Python 미사용 → 재생성 (버전 통일)');
      rmSync(join(binDir, 'streamlink-venv'), { recursive: true, force: true });
    } else {
      const filename = join('.bin', binPath.split('.bin/')[1] || 'streamlink');
      console.log(`  streamlink: found (${filename})`);
      return;
    }
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

if (skipOptionalBinaryDownloads) {
  console.log('  optional binaries: skipped (SKIP_OPTIONAL_BINARY_DOWNLOADS)');
} else {
  await setupYtDlp();
  await setupStreamlink();
}

copyWasmFiles();
console.log('');
