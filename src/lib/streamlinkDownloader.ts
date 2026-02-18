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
import { FFmpegProgressTracker, getFileDuration } from './progressParser';
import { getFfmpegPath, getStreamlinkPath } from './binPaths';
import { safeUnlink, ensureFileComplete, type Job, type JobListener, type EventEmitter, type JobEvent } from './downloadTypes';
import { runWithTimeout } from './processUtils';
import { PROCESS, EXPORT, POLLING } from '@/constants/appConfig';
import { clamp } from '@/utils/mathUtils';
import { formatTime } from '@/utils/timeFormatter';

export type { Job, JobListener, EventEmitter };

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
  updateJobStatus: (jobId: string, job: Partial<Job>) => void
): Promise<void> {
  const { url, startTime, endTime, filename, tbr } = params;
  const outputPath = join(tmpdir(), `download_${jobId}.mp4`);
  const tempFile = join(tmpdir(), `streamlink_temp_${jobId}.mp4`);

  let processedSeconds = 0;
  let lastEmittedProgress = -1;
  let lastEmittedPhase: string | null = null;
  const segmentDuration = endTime - startTime;
  let totalSeconds = Math.max(1, segmentDuration);

  const estimatedBitrate = tbr || EXPORT.DEFAULT_BITRATE_KBPS;
  const estimatedBytes = ((estimatedBitrate * 1024) / 8) * segmentDuration;
  // console.log(`[SSE] Estimated: ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB (${estimatedBitrate} kbps)`);

  let currentPhase: 'downloading' | 'processing' | 'completed' = 'downloading';
  let lastLoggedProgress = -1;

  const computeProgress = () => clamp((processedSeconds / totalSeconds) * 100, 0, 100);

  const emitProgress = (phase: 'downloading' | 'processing' | 'completed', force = false) => {
    const roundedProgress = Math.round(computeProgress());

    if (!force && roundedProgress === lastEmittedProgress && phase === lastEmittedPhase) {
      return;
    }

    // console.log(`[SSE] ${phase}: ${roundedProgress}% (${processedSeconds.toFixed(2)}s)`);

    emitEvent(jobId, {
      type: 'progress',
      jobId,
      progress: roundedProgress,
      processedSeconds: Number(processedSeconds.toFixed(2)),
      totalSeconds: Number(totalSeconds.toFixed(2)),
      phase,
    });

    lastEmittedProgress = roundedProgress;
    lastEmittedPhase = phase;
  };

  const updateProgress = (progressPercent: number, expectedPhase: string) => {
    if (currentPhase !== expectedPhase) return;
    const normalized = clamp(progressPercent, 0, 100);
    const seconds = (segmentDuration * normalized) / 100;
    if (seconds > processedSeconds || expectedPhase === 'downloading') {
      processedSeconds = expectedPhase === 'downloading' ? seconds : Math.max(processedSeconds, seconds);
      emitProgress(expectedPhase as 'downloading' | 'processing');
    }
  };

  try {
    const streamlinkBin = getStreamlinkPath();
    if (!streamlinkBin) throw new Error('Streamlink이 설치되어 있지 않습니다');

    emitProgress('downloading', true);

    // console.log(
    //   `[SSE] Phase 1 (Downloading) - offset=${formatTime(startTime, false)} duration=${formatTime(segmentDuration, false)}`
    // );

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
      '6',
      url,
      'best',
      '-o',
      tempFile,
    ];

    if (streamlinkBin.endsWith('.AppImage')) {
      streamlinkArgs.unshift('--appimage-extract-and-run');
    }

    const streamlinkProc = spawn(streamlinkBin, streamlinkArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let streamlinkStderr = '';

    streamlinkProc.stderr?.on('data', (chunk: Buffer) => {
      streamlinkStderr += chunk.toString();
    });

    const progressInterval = setInterval(async () => {
      if (currentPhase !== 'downloading') {
        clearInterval(progressInterval);
        return;
      }

      try {
        const stats = await fsPromises.stat(tempFile);
        const progress = Math.min(100, (stats.size / estimatedBytes) * 100);
        updateProgress(progress, 'downloading');

        // const rounded = Math.floor(progress / 5) * 5;
        // if (rounded % 5 === 0 && rounded !== lastLoggedProgress) {
        //   console.log(
        //     `[SSE] Downloaded: ${(stats.size / 1024 / 1024).toFixed(1)} MB / ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB`
        //   );
        //   lastLoggedProgress = rounded;
        // }
      } catch {}
    }, POLLING.PROGRESS_CHECK_INTERVAL_MS);

    const streamlinkSuccess = await (async () => {
      const result = await runWithTimeout(streamlinkProc, PROCESS.STREAMLINK_TIMEOUT_MS);
      clearInterval(progressInterval);
      streamlinkProc.stderr?.removeAllListeners('data');

      // console.log('[SSE] Streamlink closed');

      // try {
      //   const stats = await fsPromises.stat(tempFile);
      //   console.log(`[SSE] Final: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
      // } catch {}

      // const debugPath = join(tmpdir(), `streamlink_debug_${jobId}.log`);
      // try {
      //   writeFileSync(debugPath, streamlinkStderr, 'utf-8');
      //   console.log(`[SSE] Stderr: ${debugPath}`);
      // } catch {}

      return result && existsSync(tempFile);
    })();

    if (!streamlinkSuccess) {
      safeUnlink(tempFile);
      throw new Error('Streamlink 다운로드에 실패했습니다');
    }

    const actualDuration = await getFileDuration(tempFile);
    // console.log(`[SSE] Phase 1 completed - Duration: ${actualDuration.toFixed(1)}s / ${segmentDuration}s`);

    // ===== PHASE 2: FFmpeg 타임스탬프 리셋 =====
    processedSeconds = 0;
    totalSeconds = segmentDuration;
    currentPhase = 'processing';
    emitProgress('processing', true);

    // console.log('[SSE] Phase 2 (Processing) - ffmpeg timestamp reset');

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

    const ffmpegTracker = new FFmpegProgressTracker(segmentDuration);
    let lastFFmpegLog = -1;

    ffmpegProc.stderr?.on('data', (chunk: Buffer) => {
      const progress = ffmpegTracker.pushChunk(chunk);
      updateProgress(progress, 'processing');

      // const rounded = Math.floor(progress / 5) * 5;
      // if (rounded !== lastFFmpegLog) {
      //   console.log(`[SSE] FFmpeg: ${ffmpegTracker.getProcessedSeconds().toFixed(1)}s (${progress.toFixed(1)}%)`);
      //   lastFFmpegLog = rounded;
      // }
    });

    const ffmpegSuccess = await runWithTimeout(ffmpegProc, PROCESS.FFMPEG_TIMEOUT_MS);

    safeUnlink(tempFile);

    if (!ffmpegSuccess || !existsSync(outputPath)) {
      safeUnlink(outputPath);
      throw new Error('FFmpeg 처리에 실패했습니다');
    }

    // ✅ 파일 버퍼 플러시 완료 대기 (일관성 유지)
    try {
      await ensureFileComplete(outputPath);
      console.log('[Streamlink] File write completed and verified:', outputPath);
    } catch (error) {
      safeUnlink(outputPath);
      throw new Error('파일 쓰기 검증에 실패했습니다');
    }

    // ===== 완료 =====
    updateProgress(100, 'processing');
    // console.log('[SSE] Phase 2 completed: 100%');
    currentPhase = 'completed';
    emitProgress('completed', true);

    emitEvent(jobId, {
      type: 'complete',
      jobId,
      filename: filename || 'video.mp4',
    });

    updateJobStatus(jobId, { outputPath, status: 'completed' });
    // console.log(`[SSE] Job completed: ${jobId}`);
  } catch (error) {
    safeUnlink(tempFile);
    safeUnlink(outputPath);
    console.error(`[SSE] Job failed: ${jobId}`, error);

    emitEvent(jobId, {
      type: 'error',
      jobId,
      message: error instanceof Error ? error.message : '다운로드에 실패했습니다',
    });

    updateJobStatus(jobId, {
      outputPath: null,
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : '다운로드에 실패했습니다',
    });
  }
}
