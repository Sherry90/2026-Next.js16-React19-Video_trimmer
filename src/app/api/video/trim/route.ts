import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { getFfmpegPath, getStreamlinkPath, hasStreamlink } from '@/lib/binPaths';
import { formatTimeHHMMSS } from '@/features/timeline/utils/timeFormatter';
import { runWithTimeout } from '@/lib/processUtils';
import { validateTrimRequest, handleApiError } from '@/lib/apiUtils';
import { streamFile } from '@/lib/streamUtils';

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

    // 파라미터 검증
    const validation = validateTrimRequest(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { originalUrl, startTime, endTime, filename } = validation.data;
    const outputFilename = filename || 'trimmed_video.mp4';
    const success = await trimWithStreamlink(originalUrl, startTime, endTime, tmpFile);

    if (!success) {
      return NextResponse.json(
        { error: 'streamlink 트리밍에 실패했습니다. streamlink 설치를 확인해주세요.' },
        { status: 500 }
      );
    }

    // Stream the output file
    console.log('[trim] Streaming file to client...');

    return streamFile({
      filePath: tmpFile,
      contentType: 'video/mp4',
      onStreamEnd: () => {
        try {
          unlinkSync(tmpFile);
        } catch {
          /* ignore */
        }
      },
      onStreamError: (err) => {
        console.error('[trim] Stream error:', err);
        try {
          unlinkSync(tmpFile);
        } catch {
          /* ignore */
        }
      },
    });
  } catch (error: unknown) {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
    return handleApiError(error, 'trim', '트리밍 처리 중 오류가 발생했습니다');
  }
}
