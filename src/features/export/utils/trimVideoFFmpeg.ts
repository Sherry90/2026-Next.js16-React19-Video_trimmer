import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL, fetchFile } from '@ffmpeg/util';

export interface TrimOptions {
  ffmpeg: FFmpeg;
  inputFile: File;
  startTime: number;  // seconds
  endTime: number;    // seconds
  onProgress?: (progress: number) => void; // 0-100
}

/**
 * Trim video using FFmpeg.wasm with stream copy (no re-encoding)
 *
 * Uses WORKERFS for large file support and -c copy for fast processing
 *
 * Limitations:
 * - Recommended file size: < 500MB
 * - Maximum file size: ~1-2GB (depending on browser memory)
 * - Trim points are adjusted to nearest keyframe (may result in slightly longer output)
 *   Example: Requesting 2-5s (3s duration) may produce a 5s video if keyframes are at 0s and 5s
 * - For frame-accurate trimming, re-encoding would be required (much slower)
 */
export async function trimVideoFFmpeg(options: TrimOptions): Promise<Blob> {
  const { ffmpeg, inputFile, startTime, endTime, onProgress } = options;

  try {
    onProgress?.(0);

    // Input and output filenames
    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    // Write input file to FFmpeg filesystem
    // For large files, this uses WORKERFS internally
    onProgress?.(10);
    await ffmpeg.writeFile(inputFileName, await fetchFile(inputFile));

    onProgress?.(20);

    // Calculate duration
    const duration = endTime - startTime;

    // FFmpeg command with stream copy (no re-encoding)
    // -ss: start time (BEFORE -i for fast seeking - keyframe-based, may be slightly imprecise)
    // -i: input file
    // -t: duration
    // -c copy: stream copy (no re-encoding)
    // -avoid_negative_ts make_zero: fix timestamp issues
    //
    // Note: Using -ss BEFORE -i enables fast input seeking but cuts at keyframes only,
    // which may result in slightly longer output than specified (e.g., 5s instead of 3s).
    // Using -ss AFTER -i would be more accurate but often drops video stream with -c copy.
    const ffmpegArgs = [
      '-ss', startTime.toString(),
      '-i', inputFileName,
      '-t', duration.toString(),
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      outputFileName
    ];

    onProgress?.(30);

    // Execute FFmpeg command
    await ffmpeg.exec(ffmpegArgs);

    onProgress?.(80);

    // Read output file
    const data = await ffmpeg.readFile(outputFileName);

    onProgress?.(90);

    // Clean up
    await ffmpeg.deleteFile(inputFileName);
    await ffmpeg.deleteFile(outputFileName);

    onProgress?.(95);

    // Convert to Blob
    // data is FileData (Uint8Array | string), we expect Uint8Array for video files
    if (typeof data === 'string') {
      throw new Error('Unexpected string data from FFmpeg');
    }

    // Create a new Uint8Array to avoid SharedArrayBuffer issues
    const uint8Array = new Uint8Array(data);
    const blob = new Blob([uint8Array], { type: inputFile.type || 'video/mp4' });

    onProgress?.(100);

    return blob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Video trimming failed: ${errorMessage}`);
  }
}
