import { NextRequest, NextResponse } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import { createReadStream, unlinkSync, statSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { getFfmpegPath, getStreamlinkPath, hasStreamlink } from '@/lib/binPaths';

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
 * Helper: kill a child process safely
 */
function killProcess(proc: ChildProcess): void {
  try {
    if (proc.pid && !proc.killed) {
      proc.kill('SIGTERM');
    }
  } catch { /* ignore */ }
}

/**
 * Streamlink → ffmpeg two-stage trimming
 *
 * Reference: scripts/cut_video.sh (original shell script)
 * - Line 216: streamlink --hls-start-offset --stream-segmented-duration
 * - Line 226: ffmpeg -i temp.mp4 -c copy -avoid_negative_ts make_zero
 *
 * Stage 1: streamlink downloads segment to temp file
 * Stage 2: ffmpeg resets timestamps with copy codec
 *
 * Uses --stream-segmented-duration for accurate segment extraction.
 */
async function trimWithStreamlink(
  originalUrl: string,
  startTime: number,
  endTime: number,
  outputPath: string,
): Promise<boolean> {
  const streamlinkBin = getStreamlinkPath();
  if (!streamlinkBin) {
    return false;
  }

  const duration = endTime - startTime;
  const ffmpegPath = getFfmpegPath();
  const tempFile = join(tmpdir(), `streamlink_temp_${randomUUID()}.mp4`);

  try {
    // Stage 1: Download segment with streamlink
    console.log(`[trim] Stage 1 - streamlink download: offset=${formatTime(startTime)} duration=${formatTime(duration)}`);

    const streamlinkSuccess = await new Promise<boolean>((resolve) => {
      const args = [
        '--hls-start-offset', formatTime(startTime),
        '--stream-segmented-duration', formatTime(duration),
        '--stream-segment-threads', '6',  // 병렬 다운로드 (1-10, 기본값 1)
        originalUrl,
        'best',
        '-o', tempFile,
      ];

      // Linux AppImage: FUSE 없는 환경 대응
      if (streamlinkBin.endsWith('.AppImage')) {
        args.unshift('--appimage-extract-and-run');
      }

      const streamlinkProc = spawn(streamlinkBin, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      streamlinkProc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      streamlinkProc.on('error', (err) => {
        console.log('[trim] streamlink process error:', err.message);
        resolve(false);
      });

      streamlinkProc.on('close', (code) => {
        if (code === 0 && existsSync(tempFile)) {
          console.log('[trim] Stage 1 - streamlink download succeeded');
          resolve(true);
        } else {
          console.log(`[trim] streamlink exited with code ${code}:`, stderr.slice(0, 300));
          resolve(false);
        }
      });

      // Timeout: 300s for streamlink download
      const timeout = setTimeout(() => {
        console.log('[trim] streamlink download timed out after 300s');
        killProcess(streamlinkProc);
        resolve(false);
      }, 300000);

      streamlinkProc.on('close', () => clearTimeout(timeout));
    });

    if (!streamlinkSuccess) {
      try { unlinkSync(tempFile); } catch { /* ignore */ }
      return false;
    }

    // Stage 2: Reset timestamps with ffmpeg
    console.log('[trim] Stage 2 - ffmpeg timestamp reset');

    const ffmpegSuccess = await new Promise<boolean>((resolve) => {
      const ffmpegProc = spawn(ffmpegPath, [
        '-y',
        '-i', tempFile,
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-fflags', '+genpts',
        '-movflags', '+faststart',
        outputPath,
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';
      ffmpegProc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      ffmpegProc.on('error', (err) => {
        console.log('[trim] ffmpeg process error:', err.message);
        resolve(false);
      });

      ffmpegProc.on('close', (code) => {
        if (code === 0 && existsSync(outputPath)) {
          console.log('[trim] Stage 2 - ffmpeg timestamp reset succeeded');
          resolve(true);
        } else {
          console.log(`[trim] ffmpeg exited with code ${code}:`, stderr.slice(0, 300));
          resolve(false);
        }
      });

      // Timeout: 60s for ffmpeg copy
      const timeout = setTimeout(() => {
        console.log('[trim] ffmpeg timestamp reset timed out after 60s');
        killProcess(ffmpegProc);
        resolve(false);
      }, 60000);

      ffmpegProc.on('close', () => clearTimeout(timeout));
    });

    // Cleanup temp file
    try { unlinkSync(tempFile); } catch { /* ignore */ }

    return ffmpegSuccess;

  } catch (error) {
    try { unlinkSync(tempFile); } catch { /* ignore */ }
    console.log('[trim] Unexpected error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const tmpFile = join(tmpdir(), `trim_${randomUUID()}.mp4`);

  try {
    const body = await request.json();
    const { originalUrl, startTime, endTime, filename } = body;

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

    if (!originalUrl) {
      return NextResponse.json(
        { error: 'originalUrl이 필요합니다' },
        { status: 400 }
      );
    }

    const outputFilename = filename || 'trimmed_video.mp4';
    const success = await trimWithStreamlink(originalUrl, startTime, endTime, tmpFile);

    if (!success) {
      return NextResponse.json(
        { error: 'streamlink 트리밍에 실패했습니다. streamlink 설치를 확인해주세요.' },
        { status: 500 }
      );
    }

    // Stream the output file
    const stat = statSync(tmpFile);
    const fileStream = createReadStream(tmpFile);

    console.log(`[trim] Streaming file: ${stat.size} bytes (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

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

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(stat.size),
        // Content-Disposition 헤더 제거 - fetch API로 읽을 것이므로 불필요
      },
    });
  } catch (error: unknown) {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }

    const msg = error instanceof Error ? error.message : String(error);
    console.error('[trim] Error:', msg);
    return NextResponse.json(
      { error: '트리밍 처리 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
