import { spawn } from 'child_process';
import { unlinkSync, existsSync, writeFileSync, promises as fsPromises } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FFmpegProgressTracker, getFileDuration } from './progressParser';
import { getFfmpegPath, getStreamlinkPath } from './binPaths.cjs';
import { formatTimeHHMMSS } from '@/features/timeline/utils/timeFormatter';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function safeUnlink(path: string): void {
  try {
    if (path && existsSync(path)) unlinkSync(path);
  } catch {}
}

function runProcessWithTimeout(proc: any, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    const timeoutId = setTimeout(() => {
      proc.kill('SIGKILL');
      settle(false);
    }, timeoutMs);

    proc.on('close', (code: number) => settle(code === 0));
    proc.on('error', () => settle(false));
  });
}

// Event types
type ProgressEvent = {
  type: 'progress';
  jobId: string;
  progress: number;
  processedSeconds: number;
  totalSeconds: number;
  phase: 'downloading' | 'processing' | 'completed';
};

type CompleteEvent = {
  type: 'complete';
  jobId: string;
  filename: string;
};

type ErrorEvent = {
  type: 'error';
  jobId: string;
  message: string;
};

type JobEvent = ProgressEvent | CompleteEvent | ErrorEvent;

type JobListener = (event: JobEvent) => void;

type Job = {
  outputPath: string | null;
  status: 'running' | 'completed' | 'failed';
  listeners: JobListener[];
};

// Global job storage (향후 Redis/DB로 교체 가능)
const jobs = new Map<string, Job>();

/**
 * Job 스트림 구독
 */
export function getJobStream(jobId: string, listener: JobListener): () => void {
  let job = jobs.get(jobId);

  if (!job) {
    // Job이 없으면 새로 생성 (리스너만 등록)
    job = {
      outputPath: null,
      status: 'running',
      listeners: [listener],
    };
    jobs.set(jobId, job);
  } else {
    // 기존 Job에 리스너 추가
    job.listeners.push(listener);
  }

  // Unsubscribe 함수 반환
  return () => {
    const currentJob = jobs.get(jobId);
    if (currentJob) {
      currentJob.listeners = currentJob.listeners.filter((l) => l !== listener);
    }
  };
}

/**
 * 모든 리스너에게 이벤트 전송
 */
function emitEvent(jobId: string, event: JobEvent) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error(`[SSE] Listener error for job ${jobId}:`, err);
    }
  });
}

/**
 * 다운로드 작업 시작 (백그라운드)
 */
export async function startDownloadJob(
  jobId: string,
  params: {
    url: string;
    startTime: number;
    endTime: number;
    filename?: string;
    tbr?: number;
  }
) {
  const { url, startTime, endTime, filename, tbr } = params;
  const outputPath = join(tmpdir(), `download_${jobId}.mp4`);
  const tempFile = join(tmpdir(), `streamlink_temp_${jobId}.mp4`);

  // Job 등록
  const existingJob = jobs.get(jobId);
  jobs.set(jobId, {
    outputPath,
    status: 'running',
    listeners: existingJob?.listeners || [],
  });

  let processedSeconds = 0;
  let lastEmittedProgress = -1;
  let lastEmittedPhase: string | null = null;
  const segmentDuration = endTime - startTime;
  let totalSeconds = Math.max(1, segmentDuration);

  const estimatedBitrate = tbr || 2500;
  const estimatedBytes = ((estimatedBitrate * 1024) / 8) * segmentDuration;
  console.log(`[SSE] Estimated: ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB (${estimatedBitrate} kbps)`);

  let currentPhase: 'downloading' | 'processing' | 'completed' = 'downloading';
  let lastLoggedProgress = -1;

  const computeProgress = () => clamp((processedSeconds / totalSeconds) * 100, 0, 100);

  const emitProgress = (phase: 'downloading' | 'processing' | 'completed', force = false) => {
    const roundedProgress = Math.round(computeProgress());

    if (!force && roundedProgress === lastEmittedProgress && phase === lastEmittedPhase) {
      return;
    }

    console.log(`[SSE] ${phase}: ${roundedProgress}% (${processedSeconds.toFixed(2)}s)`);

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

    console.log(
      `[SSE] Phase 1 (Downloading) - offset=${formatTimeHHMMSS(startTime)} duration=${formatTimeHHMMSS(segmentDuration)}`
    );

    const streamlinkArgs = [
      '--loglevel',
      'debug',
      '--progress=force',
      '--hls-start-offset',
      formatTimeHHMMSS(startTime),
      '--hls-duration',
      formatTimeHHMMSS(segmentDuration),
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

    streamlinkProc.stderr?.on('data', (chunk: any) => {
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

        const rounded = Math.floor(progress / 5) * 5;
        if (rounded % 5 === 0 && rounded !== lastLoggedProgress) {
          console.log(
            `[SSE] Downloaded: ${(stats.size / 1024 / 1024).toFixed(1)} MB / ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB`
          );
          lastLoggedProgress = rounded;
        }
      } catch {}
    }, 200);

    const streamlinkSuccess = await (async () => {
      const result = await runProcessWithTimeout(streamlinkProc, 300000);
      clearInterval(progressInterval);
      streamlinkProc.stderr?.removeAllListeners('data');

      console.log('[SSE] Streamlink closed');

      try {
        const stats = await fsPromises.stat(tempFile);
        console.log(`[SSE] Final: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
      } catch {}

      const debugPath = join(tmpdir(), `streamlink_debug_${jobId}.log`);
      try {
        writeFileSync(debugPath, streamlinkStderr, 'utf-8');
        console.log(`[SSE] Stderr: ${debugPath}`);
      } catch {}

      return result && existsSync(tempFile);
    })();

    if (!streamlinkSuccess) {
      safeUnlink(tempFile);
      throw new Error('Streamlink 다운로드에 실패했습니다');
    }

    const actualDuration = await getFileDuration(tempFile);
    console.log(`[SSE] Phase 1 completed - Duration: ${actualDuration.toFixed(1)}s / ${segmentDuration}s`);

    processedSeconds = 0;
    totalSeconds = segmentDuration;
    currentPhase = 'processing';
    emitProgress('processing', true);

    console.log('[SSE] Phase 2 (Processing) - ffmpeg timestamp reset');

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

    ffmpegProc.stderr?.on('data', (chunk: any) => {
      const progress = ffmpegTracker.pushChunk(chunk);
      updateProgress(progress, 'processing');

      const rounded = Math.floor(progress / 5) * 5;
      if (rounded !== lastFFmpegLog) {
        console.log(`[SSE] FFmpeg: ${ffmpegTracker.getProcessedSeconds().toFixed(1)}s (${progress.toFixed(1)}%)`);
        lastFFmpegLog = rounded;
      }
    });

    const ffmpegSuccess = await runProcessWithTimeout(ffmpegProc, 60000);

    safeUnlink(tempFile);

    if (!ffmpegSuccess || !existsSync(outputPath)) {
      safeUnlink(outputPath);
      throw new Error('FFmpeg 처리에 실패했습니다');
    }

    updateProgress(100, 'processing');
    console.log('[SSE] Phase 2 completed: 100%');
    currentPhase = 'completed';
    emitProgress('completed', true);

    emitEvent(jobId, {
      type: 'complete',
      jobId,
      filename: filename || 'video.mp4',
    });

    jobs.set(jobId, { outputPath, status: 'completed', listeners: jobs.get(jobId)?.listeners || [] });
    console.log(`[SSE] Job completed: ${jobId}`);
  } catch (error) {
    safeUnlink(tempFile);
    safeUnlink(outputPath);
    console.error(`[SSE] Job failed: ${jobId}`, error);

    emitEvent(jobId, {
      type: 'error',
      jobId,
      message: error instanceof Error ? error.message : '다운로드에 실패했습니다',
    });

    jobs.set(jobId, { outputPath: null, status: 'failed', listeners: jobs.get(jobId)?.listeners || [] });
  }
}

/**
 * Job 정보 조회
 */
export function getJob(jobId: string) {
  return jobs.get(jobId);
}

/**
 * Job 삭제
 */
export function deleteJob(jobId: string) {
  const job = jobs.get(jobId);
  if (job?.outputPath) {
    safeUnlink(job.outputPath);
  }
  jobs.delete(jobId);
}
