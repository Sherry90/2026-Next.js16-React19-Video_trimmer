/**
 * Smart video trimmer dispatcher
 * Routes to MP4Box (no download) or FFmpeg (lazy load) based on video format
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { trimVideoMP4Box } from './trimVideoMP4Box';
import { trimVideoFFmpeg } from './trimVideoFFmpeg';
import { trimVideoServer } from './trimVideoServer';
import { getTrimmerType } from './formatDetector';

export interface TrimVideoOptions {
  inputFile: File | null;
  source?: 'file' | 'url';
  originalUrl?: string;
  filename?: string;
  startTime: number; // seconds
  endTime: number; // seconds
  onProgress?: (progress: number) => void; // 0-100
  onFFmpegLoadStart?: () => void;
  onFFmpegLoadProgress?: (progress: number) => void;
  onFFmpegLoadComplete?: () => void;
}

/**
 * Singleton FFmpeg instance
 * Shared across all FFmpeg trimming operations to avoid re-downloading
 */
let ffmpegInstance: FFmpeg | null = null;
let isFFmpegLoading = false;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;

/**
 * Cleanup FFmpeg instance and reset state
 * Call this when resetting the application to free up memory
 */
export function cleanupFFmpeg(): void {
  if (ffmpegInstance) {
    // FFmpeg instance doesn't have explicit cleanup, but we can null it
    ffmpegInstance = null;
  }
  isFFmpegLoading = false;
  ffmpegLoadPromise = null;
}

/**
 * Load FFmpeg.wasm with progress tracking
 * Uses singleton pattern to load only once per session
 *
 * @param onProgress - Optional callback for load progress (0-100)
 * @returns Loaded FFmpeg instance
 */
async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  // Return existing instance if already loaded
  if (ffmpegInstance) {
    return ffmpegInstance;
  }

  // If already loading, wait for that promise
  if (isFFmpegLoading && ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  // Start loading
  isFFmpegLoading = true;
  ffmpegLoadPromise = (async () => {
    try {
      onProgress?.(0);

      const ffmpeg = new FFmpeg();

      // Set up logging
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      // Set up progress callback
      ffmpeg.on('progress', ({ progress }) => {
        // progress is 0-1, convert to 0-100
        onProgress?.(Math.round(progress * 100));
      });

      // Load FFmpeg core (~20MB download)
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      onProgress?.(100);

      ffmpegInstance = ffmpeg;
      return ffmpeg;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load FFmpeg';
      console.error('FFmpeg load error:', error);
      throw new Error(errorMessage);
    } finally {
      isFFmpegLoading = false;
      ffmpegLoadPromise = null;
    }
  })();

  return ffmpegLoadPromise;
}

/**
 * Main entry point for video trimming
 * Automatically selects the best trimmer based on video format:
 * - MP4/MOV/M4V → MP4Box.js (instant, no download)
 * - Other formats → FFmpeg.wasm (lazy load ~20MB)
 *
 * @param options - Trimming options
 * @returns Trimmed video as Blob
 */
export async function trimVideo(options: TrimVideoOptions): Promise<Blob> {
  const { inputFile, source, originalUrl, filename, startTime, endTime, onProgress, onFFmpegLoadStart, onFFmpegLoadProgress, onFFmpegLoadComplete } =
    options;

  // URL source: use server-side streamlink trimming
  if (source === 'url') {
    if (!originalUrl) throw new Error('originalUrl is required for URL source');
    console.log('[Trimmer] Using server trimming for URL source');
    return trimVideoServer({
      originalUrl,
      startTime,
      endTime,
      filename: filename || 'trimmed_video.mp4',
      onProgress,
    });
  }

  // File source: use client-side trimming
  if (!inputFile) throw new Error('inputFile is required for file source');

  const trimmerType = getTrimmerType(inputFile);

  if (trimmerType === 'mp4box') {
    // Use MP4Box (no download needed)
    console.log('[Trimmer] Using MP4Box for', inputFile.type);
    return trimVideoMP4Box({
      inputFile,
      startTime,
      endTime,
      onProgress,
    });
  } else {
    // Use FFmpeg (lazy load if needed)
    console.log('[Trimmer] Using FFmpeg for', inputFile.type);

    // Notify that FFmpeg loading has started
    onFFmpegLoadStart?.();

    try {
      // Load FFmpeg with progress tracking
      const ffmpeg = await loadFFmpeg(onFFmpegLoadProgress);

      // Notify that FFmpeg loading is complete
      onFFmpegLoadComplete?.();

      // Trim with FFmpeg
      return trimVideoFFmpeg({
        ffmpeg,
        inputFile,
        startTime,
        endTime,
        onProgress,
      });
    } catch (error) {
      // Notify that FFmpeg loading failed
      onFFmpegLoadComplete?.();
      throw error;
    }
  }
}
