import { NextRequest, NextResponse } from 'next/server';
import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { createReadStream, unlinkSync, statSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { getYtdlpPath, getFfmpegPath, hasStreamlink } from '@/lib/binPaths';

const execFileAsync = promisify(execFile);

/**
 * Format seconds to HH:MM:SS for streamlink
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Try trimming with yt-dlp --download-sections
 * Works well for YouTube and many other sites
 */
async function trimWithYtDlp(
  originalUrl: string,
  startTime: number,
  endTime: number,
  outputPath: string,
): Promise<boolean> {
  try {
    const ytdlp = getYtdlpPath();
    const ffmpegPath = getFfmpegPath();
    await execFileAsync(ytdlp, [
      '--download-sections', `*${startTime}-${endTime}`,
      '--force-keyframes-at-cuts',
      '-f', 'bv*+ba/b',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--ffmpeg-location', ffmpegPath,
      '-o', outputPath,
      originalUrl,
    ], {
      timeout: 300000,
    });
    return existsSync(outputPath);
  } catch (error: any) {
    console.log('[trim] yt-dlp failed, trying fallback:', error.message?.slice(0, 200));
    return false;
  }
}

/**
 * Fallback: trim with streamlink + ffmpeg
 * Handles HLS streams that ffmpeg 8.0 rejects (e.g., Chzzk .m4v segments)
 */
async function trimWithStreamlink(
  originalUrl: string,
  startTime: number,
  endTime: number,
  outputPath: string,
): Promise<boolean> {
  if (!hasStreamlink()) {
    return false;
  }

  const rawPath = outputPath.replace('.mp4', '_raw.mp4');
  const duration = endTime - startTime;

  try {
    // Step 1: Download segment with streamlink
    await execFileAsync('streamlink', [
      '--hls-start-offset', formatTime(startTime),
      '--hls-duration', formatTime(duration),
      originalUrl, 'best',
      '-o', rawPath,
      '--force',
    ], {
      timeout: 300000,
    });

    // Step 2: Fix timestamps with ffmpeg
    const ffmpegPath = getFfmpegPath();
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        '-y',
        '-i', rawPath,
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-fflags', '+genpts',
        '-movflags', '+faststart',
        outputPath,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      ffmpeg.on('close', (code) => {
        // Clean up raw file
        try { unlinkSync(rawPath); } catch { /* ignore */ }
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg timestamp fix failed with code ${code}`));
      });
      ffmpeg.on('error', reject);
    });

    return existsSync(outputPath);
  } catch (error: any) {
    // Clean up raw file on error
    try { unlinkSync(rawPath); } catch { /* ignore */ }
    console.log('[trim] streamlink fallback failed:', error.message?.slice(0, 200));
    return false;
  }
}

/**
 * Last resort: direct ffmpeg trim with stream URL
 */
async function trimWithFfmpeg(
  streamUrl: string,
  startTime: number,
  endTime: number,
  outputPath: string,
): Promise<boolean> {
  try {
    const ffmpegPath = getFfmpegPath();
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn(ffmpegPath, [
        '-y',
        '-ss', String(startTime),
        '-to', String(endTime),
        '-i', streamUrl,
        '-c', 'copy',
        '-movflags', '+faststart',
        outputPath,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      ffmpeg.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg exited with code ${code}`));
      });
      ffmpeg.on('error', reject);
    });
    return existsSync(outputPath);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const tmpFile = join(tmpdir(), `trim_${randomUUID()}.mp4`);

  try {
    const body = await request.json();
    const { originalUrl, streamUrl, startTime, endTime, filename } = body;

    if (startTime == null || endTime == null) {
      return NextResponse.json(
        { error: 'startTime, endTime이 필요합니다' },
        { status: 400 }
      );
    }

    if (endTime <= startTime) {
      return NextResponse.json(
        { error: 'endTime은 startTime보다 커야 합니다' },
        { status: 400 }
      );
    }

    if (!originalUrl && !streamUrl) {
      return NextResponse.json(
        { error: 'originalUrl 또는 streamUrl이 필요합니다' },
        { status: 400 }
      );
    }

    const outputFilename = filename || 'trimmed_video.mp4';
    let success = false;

    if (originalUrl) {
      // Try yt-dlp first (works for YouTube, many other sites)
      success = await trimWithYtDlp(originalUrl, startTime, endTime, tmpFile);

      // Fallback to streamlink (works for HLS sites like Chzzk)
      if (!success) {
        success = await trimWithStreamlink(originalUrl, startTime, endTime, tmpFile);
      }
    }

    // Last resort: direct ffmpeg with stream URL
    if (!success && streamUrl) {
      success = await trimWithFfmpeg(streamUrl, startTime, endTime, tmpFile);
    }

    if (!success) {
      return NextResponse.json(
        { error: '트리밍에 실패했습니다. yt-dlp, streamlink, ffmpeg를 확인해주세요.' },
        { status: 500 }
      );
    }

    // Stream the output file
    const stat = statSync(tmpFile);
    const fileStream = createReadStream(tmpFile);

    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        fileStream.on('end', () => {
          controller.close();
          try { unlinkSync(tmpFile); } catch { /* ignore */ }
        });
        fileStream.on('error', (err) => {
          controller.error(err);
          try { unlinkSync(tmpFile); } catch { /* ignore */ }
        });
      },
      cancel() {
        fileStream.destroy();
        try { unlinkSync(tmpFile); } catch { /* ignore */ }
      },
    });

    const encodedFilename = encodeURIComponent(outputFilename);

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedFilename}`,
      },
    });
  } catch (error: any) {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }

    console.error('[trim] Error:', error.message || error);
    return NextResponse.json(
      { error: '트리밍 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
