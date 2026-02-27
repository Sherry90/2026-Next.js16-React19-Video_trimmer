/**
 * Streamlink 기반 다운로드 (치지직 플랫폼)
 *
 * 2단계 프로세스:
 * 1. streamlink --hls-start-offset + --hls-duration → 임시 파일
 * 2. ffmpeg 타임스탬프 리셋 (-avoid_negative_ts make_zero)
 */

import { spawn } from 'child_process';
import { existsSync, promises as fsPromises } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FFmpegProgressTracker } from './progressParser';
import { getFfmpegPath, getStreamlinkPath } from './binPaths';
import { safeUnlink, ensureFileComplete, DownloadProgressTracker, type Job, type EventEmitter } from './downloadTypes';
import { runWithTimeout } from './processUtils';
import { PROCESS, EXPORT, POLLING, DOWNLOAD } from '@/constants/appConfig';
import { formatTime } from '@/utils/timeFormatter';

/**
 * Streamlink 기반 다운로드 실행
 */
export async function downloadWithStreamlink(
  jobId: string,
  params: {
    url: string;
    startTime: number;
    endTime: number;
    filename?: string;
    tbr?: number;
  },
  emitEvent: EventEmitter,
  updateJobStatus: (jobId: string, job: Partial<Job>) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  const { url, startTime, endTime, filename, tbr } = params;
  const outputPath = join(tmpdir(), `download_${jobId}.mp4`);
  const tempFile = join(tmpdir(), `streamlink_temp_${jobId}.mp4`);

  const segmentDuration = endTime - startTime;
  const estimatedBitrate = tbr || EXPORT.DEFAULT_BITRATE_KBPS;
  const estimatedBytes = ((estimatedBitrate * 1024) / 8) * segmentDuration;

  const tracker = new DownloadProgressTracker(jobId, emitEvent, segmentDuration, 'downloading');

  // 현재 실행 중인 자식 프로세스 추적 (abort 시 종료)
  let currentProc: ReturnType<typeof spawn> | null = null;

  abortSignal?.addEventListener('abort', () => {
    if (currentProc && !currentProc.killed) {
      currentProc.kill('SIGTERM');
      const proc = currentProc;
      setTimeout(() => { if (!proc.killed) proc.kill('SIGKILL'); }, 2000);
    }
  });

  try {
    const streamlinkBin = getStreamlinkPath();
    if (!streamlinkBin) throw new Error('Streamlink이 설치되어 있지 않습니다');

    tracker.emitProgress('downloading', true);

    // ===== PHASE 1: Streamlink 구간 다운로드 =====
    const streamlinkArgs = [
      '--loglevel',
      'debug',
      '--progress=force',
      '--hls-start-offset',
      formatTime(startTime, false),
      '--hls-duration',
      formatTime(segmentDuration, false),
      '--stream-segment-threads',
      String(DOWNLOAD.STREAMLINK_SEGMENT_THREADS),
      url,
      'best',
      '-o',
      tempFile,
    ];

    if (streamlinkBin.endsWith('.AppImage')) {
      streamlinkArgs.unshift('--appimage-extract-and-run');
    }

    const streamlinkProc = spawn(streamlinkBin, streamlinkArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    currentProc = streamlinkProc;
    let streamlinkStderr = '';

    streamlinkProc.stderr?.on('data', (chunk: Buffer) => {
      streamlinkStderr = (streamlinkStderr + chunk.toString()).slice(-50_000);
    });

    const progressInterval = setInterval(async () => {
      if (tracker.getCurrentPhase() !== 'downloading') {
        clearInterval(progressInterval);
        return;
      }

      try {
        const stats = await fsPromises.stat(tempFile);
        const progress = Math.min(100, (stats.size / estimatedBytes) * 100);
        tracker.updateProgress(progress, 'downloading');
      } catch {}
    }, POLLING.PROGRESS_CHECK_INTERVAL_MS);

    const streamlinkSuccess = await (async () => {
      const result = await runWithTimeout(streamlinkProc, PROCESS.STREAMLINK_TIMEOUT_MS);
      clearInterval(progressInterval);
      streamlinkProc.stderr?.removeAllListeners('data');
      currentProc = null;

      return result && existsSync(tempFile);
    })();

    if (!streamlinkSuccess) {
      safeUnlink(tempFile);
      throw new Error('Streamlink 다운로드에 실패했습니다');
    }

    // Phase 1→2 전환 중 abort 신호 확인 (레이스 컨디션 방지)
    if (abortSignal?.aborted) {
      safeUnlink(tempFile);
      throw new Error('다운로드가 취소되었습니다');
    }

    // ===== PHASE 2: FFmpeg 타임스탬프 리셋 =====
    tracker.resetForPhase('processing');
    tracker.emitProgress('processing', true);

    const ffmpegProc = spawn(
      getFfmpegPath(),
      [
        '-y',
        '-i',
        tempFile,
        '-c',
        'copy',
        '-avoid_negative_ts',
        'make_zero',
        '-fflags',
        '+genpts',
        '-movflags',
        '+faststart',
        '-progress',
        'pipe:2',
        '-nostats',
        outputPath,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    currentProc = ffmpegProc;

    const ffmpegTracker = new FFmpegProgressTracker(segmentDuration);

    ffmpegProc.stderr?.on('data', (chunk: Buffer) => {
      const progress = ffmpegTracker.pushChunk(chunk);
      tracker.updateProgress(progress, 'processing');
    });

    const ffmpegSuccess = await runWithTimeout(ffmpegProc, PROCESS.FFMPEG_TIMEOUT_MS);
    currentProc = null;

    safeUnlink(tempFile);

    if (!ffmpegSuccess || !existsSync(outputPath)) {
      safeUnlink(outputPath);
      throw new Error('FFmpeg 처리에 실패했습니다');
    }

    try {
      await ensureFileComplete(outputPath);
      console.log('[Streamlink] File write completed and verified:', outputPath);
    } catch (error) {
      safeUnlink(outputPath);
      throw new Error('파일 쓰기 검증에 실패했습니다');
    }

    // ===== 완료 =====
    tracker.updateProgress(100, 'processing');
    tracker.setCurrentPhase('completed');
    tracker.emitProgress('completed', true);
    tracker.emitComplete(filename || 'video.mp4');
    updateJobStatus(jobId, { outputPath, status: 'completed' });
  } catch (error) {
    safeUnlink(tempFile);
    safeUnlink(outputPath);
    console.error(`[SSE] Job failed: ${jobId}`, error);

    const errorMessage = error instanceof Error ? error.message : '다운로드에 실패했습니다';
    tracker.emitError(errorMessage);
    updateJobStatus(jobId, { outputPath: null, status: 'failed', errorMessage });
  }
}
