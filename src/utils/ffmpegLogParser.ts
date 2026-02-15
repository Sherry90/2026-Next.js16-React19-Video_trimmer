/**
 * FFmpeg log parsing utilities for accurate progress tracking
 */
import { formatDuration } from '@/utils/timeFormatter';

export interface FFmpegProgress {
  processedTime: number; // seconds
  fps: number;
  speed: number; // multiplier (e.g., 2.3x = 2.3)
  bitrate: number; // kbits/s
  size: number; // bytes
}

/**
 * Parse FFmpeg log line to extract progress information
 *
 * FFmpeg outputs progress in format:
 * "frame=  120 fps= 30 q=-1.0 size=    1024kB time=00:00:04.00 bitrate=2097.2kbits/s speed=1.2x"
 *
 * @param message - FFmpeg log message
 * @returns Parsed progress information, or null if not a progress line
 */
export function parseFFmpegProgress(message: string): FFmpegProgress | null {
  // Check if this is a progress line (contains "time=" and other indicators)
  if (!message.includes('time=')) {
    return null;
  }

  const result: Partial<FFmpegProgress> = {};

  // Parse time (format: HH:MM:SS.MS or MM:SS.MS)
  const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (timeMatch) {
    const [, hours, minutes, seconds] = timeMatch;
    result.processedTime =
      parseInt(hours, 10) * 3600 +
      parseInt(minutes, 10) * 60 +
      parseFloat(seconds);
  }

  // Parse FPS
  const fpsMatch = message.match(/fps=\s*(\d+(?:\.\d+)?)/);
  if (fpsMatch) {
    result.fps = parseFloat(fpsMatch[1]);
  }

  // Parse speed (format: "1.2x" or "2.3x")
  const speedMatch = message.match(/speed=\s*(\d+(?:\.\d+)?)x/);
  if (speedMatch) {
    result.speed = parseFloat(speedMatch[1]);
  }

  // Parse bitrate (format: "2097.2kbits/s")
  const bitrateMatch = message.match(/bitrate=\s*(\d+(?:\.\d+)?)kbits\/s/);
  if (bitrateMatch) {
    result.bitrate = parseFloat(bitrateMatch[1]);
  }

  // Parse size (format: "1024kB" or "1MB")
  const sizeMatch = message.match(/size=\s*(\d+(?:\.\d+)?)(kB|MB|GB)/);
  if (sizeMatch) {
    const value = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2];
    result.size =
      unit === 'kB'
        ? value * 1024
        : unit === 'MB'
        ? value * 1024 * 1024
        : value * 1024 * 1024 * 1024;
  }

  // Return null if no useful information was parsed
  if (!result.processedTime) {
    return null;
  }

  return result as FFmpegProgress;
}

/**
 * Calculate progress percentage from processed time and total duration
 */
export function calculateProgress(
  processedTime: number,
  totalDuration: number
): number {
  if (totalDuration <= 0) return 0;
  return Math.min((processedTime / totalDuration) * 100, 100);
}

/**
 * Estimate remaining time based on speed
 */
export function estimateRemainingTime(
  processedTime: number,
  totalDuration: number,
  speed: number
): number {
  if (speed <= 0) return 0;
  const remainingDuration = totalDuration - processedTime;
  return remainingDuration / speed;
}

// Re-export formatDuration for backward compatibility
export { formatDuration };
