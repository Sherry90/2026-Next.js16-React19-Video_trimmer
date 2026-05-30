/**
 * Smart video trimmer dispatcher
 * Routes to MP4Box (no download) or FFmpeg (lazy load) based on video format
 */

import { trimVideoMP4Box } from './trimVideoMP4Box';
import { trimVideoFFmpeg } from './trimVideoFFmpeg';
import { trimVideoServer } from './trimVideoServer';
import { getTrimmerType } from './formatDetector';
import { FFmpegSingleton } from './FFmpegSingleton';
import { registerCleanup } from '@/lib/cleanup';

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

// 모듈 로드 시 cleanup 자동 등록 (의존성 역전)
registerCleanup(cleanupFFmpeg);

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

  // URL source: 서버 측 트리밍(streamlink/yt-dlp)
  if (source === 'url') {
    if (!originalUrl) throw new Error('originalUrl is required for URL source');
    return trimVideoServer({
      originalUrl,
      startTime,
      endTime,
      filename: filename || 'trimmed_video.mp4',
      onProgress,
    });
  }

  // File source: 클라이언트 측 트리밍
  if (!inputFile) throw new Error('inputFile is required for file source');

  const trimmerType = getTrimmerType(inputFile);

  // MP4 계열: MP4Box stream-copy (다운로드/인코딩 없음)
  if (trimmerType === 'mp4box') {
    return trimVideoMP4Box({
      inputFile,
      startTime,
      endTime,
      onProgress,
    });
  }

  // 그 외 포맷: FFmpeg.wasm (wasm core는 최초 1회 lazy load)
  onFFmpegLoadStart?.();
  try {
    const ffmpeg = await FFmpegSingleton.getInstance(onFFmpegLoadProgress);
    onFFmpegLoadComplete?.();
    return trimVideoFFmpeg({
      ffmpeg,
      inputFile,
      startTime,
      endTime,
      onProgress,
    });
  } catch (error) {
    onFFmpegLoadComplete?.(); // 로드 실패도 완료로 통지(스피너 정리)
    throw error;
  }
}
