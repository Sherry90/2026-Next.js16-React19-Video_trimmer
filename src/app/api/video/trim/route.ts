import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { createReadStream, unlinkSync, statSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { getFfmpegPath, getStreamlinkPath, hasStreamlink } from '@/lib/binPaths';
import { formatTimeHHMMSS } from '@/features/timeline/utils/timeFormatter';
import { runWithTimeout } from '@/lib/processUtils';
import { handleApiError } from '@/lib/apiErrorHandler';

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
    console.log(`[trim] Stage 1 - streamlink download: offset=${formatTimeHHMMSS(startTime)} duration=${formatTimeHHMMSS(duration)}`);

    const args = [
      '--hls-start-offset', formatTimeHHMMSS(startTime),
      '--stream-segmented-duration', formatTimeHHMMSS(duration),
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

    const streamlinkSuccess = await runWithTimeout(streamlinkProc, {
      timeoutMs: 300000,
      logPrefix: '[trim] Stage 1 - streamlink download',
      onSuccess: (code) => code === 0 && existsSync(tempFile),
    });

    if (!streamlinkSuccess) {
      try { unlinkSync(tempFile); } catch { /* ignore */ }
      return false;
    }

    // Stage 2: Reset timestamps with ffmpeg
    console.log('[trim] Stage 2 - ffmpeg timestamp reset');

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

    const ffmpegSuccess = await runWithTimeout(ffmpegProc, {
      timeoutMs: 60000,
      logPrefix: '[trim] Stage 2 - ffmpeg timestamp reset',
      onSuccess: (code) => code === 0 && existsSync(outputPath),
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
    return handleApiError(error, 'trim', '트리밍 처리 중 오류가 발생했습니다');
  }
}
