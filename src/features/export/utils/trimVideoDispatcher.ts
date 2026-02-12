/**
 * Smart video trimmer dispatcher
 * Routes to MP4Box (no download) or FFmpeg (lazy load) based on video format
 */

import { trimVideoMP4Box } from './trimVideoMP4Box';
import { trimVideoFFmpeg } from './trimVideoFFmpeg';
import { trimVideoServer } from './trimVideoServer';
import { getTrimmerType } from './formatDetector';
import { FFmpegSingleton } from './FFmpegSingleton';

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
 * Cleanup FFmpeg instance and reset state
 * Call this when resetting the application to free up memory
 */
export function cleanupFFmpeg(): void {
  FFmpegSingleton.cleanup();
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
      const ffmpeg = await FFmpegSingleton.getInstance(onFFmpegLoadProgress);

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
