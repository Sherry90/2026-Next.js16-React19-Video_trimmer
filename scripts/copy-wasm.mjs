#!/usr/bin/env node
/**
 * Copy FFmpeg.wasm files from node_modules to public/ffmpeg/
 * This enables self-hosted WASM instead of loading from CDN at runtime.
 *
 * Source: node_modules/@ffmpeg/core/dist/umd/
 * Dest:   public/ffmpeg/
 */

import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

const srcDir = join(projectRoot, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd');
const destDir = join(projectRoot, 'public', 'ffmpeg');

const files = [
  'ffmpeg-core.js',
  'ffmpeg-core.wasm',
];

if (!existsSync(srcDir)) {
  console.error('  ffmpeg-wasm: @ffmpeg/core not found in node_modules. Run npm install first.');
  process.exit(1);
}

if (!existsSync(destDir)) {
  mkdirSync(destDir, { recursive: true });
}

let copied = 0;
let skipped = 0;

for (const file of files) {
  const src = join(srcDir, file);
  const dest = join(destDir, file);

  if (!existsSync(src)) {
    console.warn(`  ffmpeg-wasm: source file not found: ${file}`);
    continue;
  }

  if (existsSync(dest)) {
    skipped++;
    continue;
  }

  copyFileSync(src, dest);
  copied++;
}

if (copied > 0) {
  console.log(`  ffmpeg-wasm: copied ${copied} file(s) to public/ffmpeg/`);
} else if (skipped === files.length) {
  console.log(`  ffmpeg-wasm: already up to date (public/ffmpeg/)`);
}
