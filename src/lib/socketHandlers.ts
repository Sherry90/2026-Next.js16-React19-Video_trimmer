import { spawn } from 'child_process';
import { unlinkSync, existsSync, writeFileSync, promises as fsPromises } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
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

export default function setupSocketHandlers(io: any) {
  const jobs = new Map();
  (global as any).__socketIO_jobs = jobs;

  io.on('connection', (socket: any) => {
    console.log('[Socket.IO] Client connected:', socket.id);
    socket.on('disconnect', () => console.log('[Socket.IO] Client disconnected:', socket.id));

    socket.on('start-download', async (data: any) => {
      const { url, startTime, endTime, filename, tbr } = data;
      const jobId = randomUUID();
      const outputPath = join(tmpdir(), `download_${jobId}.mp4`);
      const tempFile = join(tmpdir(), `streamlink_temp_${jobId}.mp4`);

      console.log('[Socket.IO] ========== NEW DOWNLOAD STARTED ==========');
      console.log(`[Socket.IO] Job: ${jobId}, URL: ${url}, Range: ${startTime}s-${endTime}s`);

      jobs.set(jobId, { outputPath, status: 'running' });

      let processedSeconds = 0;
      let lastEmittedProgress = -1;
      let lastEmittedPhase: string | null = null;
      const segmentDuration = endTime - startTime;
      let totalSeconds = Math.max(1, segmentDuration);

      const estimatedBitrate = tbr || 2500;
      const estimatedBytes = (estimatedBitrate * 1024 / 8) * segmentDuration;
      console.log(`[Socket.IO] Estimated: ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB (${estimatedBitrate} kbps)`);

      let currentPhase: 'downloading' | 'processing' | 'completed' = 'downloading';
      let lastLoggedProgress = -1;

      const computeProgress = () => clamp((processedSeconds / totalSeconds) * 100, 0, 100);

      const emitProgress = (phase: string, force = false) => {
        const roundedProgress = Math.round(computeProgress());

        if (!force && roundedProgress === lastEmittedProgress && phase === lastEmittedPhase) {
          return;
        }

        console.log(`[Socket.IO] ${phase}: ${roundedProgress}% (${processedSeconds.toFixed(2)}s)`);
        socket.emit('progress', {
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
          emitProgress(expectedPhase);
        }
      };

      try {
        if (!url?.trim() || typeof startTime !== 'number' || typeof endTime !== 'number' || endTime <= startTime) {
          throw new Error('유효하지 않은 파라미터');
        }

        const streamlinkBin = getStreamlinkPath();
        if (!streamlinkBin) throw new Error('Streamlink이 설치되어 있지 않습니다');

        emitProgress('downloading', true);

        console.log(`[Socket.IO] Phase 1 (Downloading) - offset=${formatTimeHHMMSS(startTime)} duration=${formatTimeHHMMSS(segmentDuration)}`);

        const streamlinkArgs = [
          '--loglevel', 'debug',
          '--progress=force',
          '--hls-start-offset', formatTimeHHMMSS(startTime),
          '--stream-segmented-duration', formatTimeHHMMSS(segmentDuration),
          '--stream-segment-threads', '6',
          url, 'best', '-o', tempFile,
        ];

        if (streamlinkBin.endsWith('.AppImage')) {
          streamlinkArgs.unshift('--appimage-extract-and-run');
        }

        const streamlinkProc = spawn(streamlinkBin, streamlinkArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
        let streamlinkStderr = '';

        streamlinkProc.stderr?.on('data', (chunk: any) => { streamlinkStderr += chunk.toString(); });

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
              console.log(`[Socket.IO] Downloaded: ${(stats.size / 1024 / 1024).toFixed(1)} MB / ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB`);
              lastLoggedProgress = rounded;
            }
          } catch {}
        }, 200);

        const streamlinkSuccess = await (async () => {
          const result = await runProcessWithTimeout(streamlinkProc, 300000);
          clearInterval(progressInterval);
          streamlinkProc.stderr?.removeAllListeners('data');

          console.log('[Socket.IO] Streamlink closed');

          try {
            const stats = await fsPromises.stat(tempFile);
            console.log(`[Socket.IO] Final: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
          } catch {}

          const debugPath = join(tmpdir(), `streamlink_debug_${jobId}.log`);
          try {
            writeFileSync(debugPath, streamlinkStderr, 'utf-8');
            console.log(`[Socket.IO] Stderr: ${debugPath}`);
          } catch {}

          return result && existsSync(tempFile);
        })();

        if (!streamlinkSuccess) {
          safeUnlink(tempFile);
          throw new Error('Streamlink 다운로드에 실패했습니다');
        }

        const actualDuration = await getFileDuration(tempFile);
        console.log(`[Socket.IO] Phase 1 completed - Duration: ${actualDuration.toFixed(1)}s / ${segmentDuration}s`);

        processedSeconds = 0;
        totalSeconds = segmentDuration;
        currentPhase = 'processing';
        emitProgress('processing', true);

        console.log('[Socket.IO] Phase 2 (Processing) - ffmpeg timestamp reset');

        const ffmpegProc = spawn(getFfmpegPath(), [
          '-y', '-i', tempFile,
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
          '-fflags', '+genpts',
          '-movflags', '+faststart',
          '-progress', 'pipe:2',
          '-nostats',
          outputPath,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        const ffmpegTracker = new FFmpegProgressTracker(segmentDuration);
        let lastFFmpegLog = -1;

        ffmpegProc.stderr?.on('data', (chunk: any) => {
          const progress = ffmpegTracker.pushChunk(chunk);
          updateProgress(progress, 'processing');

          const rounded = Math.floor(progress / 5) * 5;
          if (rounded !== lastFFmpegLog) {
            console.log(`[Socket.IO] FFmpeg: ${ffmpegTracker.getProcessedSeconds().toFixed(1)}s (${progress.toFixed(1)}%)`);
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
        console.log('[Socket.IO] Phase 2 completed: 100%');
        currentPhase = 'completed';
        emitProgress('completed', true);

        socket.emit('complete', { jobId, filename: filename || 'video.mp4' });
        jobs.set(jobId, { outputPath, status: 'completed' });
        console.log(`[Socket.IO] Job completed: ${jobId}`);
      } catch (error) {
        safeUnlink(tempFile);
        safeUnlink(outputPath);
        console.error(`[Socket.IO] Job failed: ${jobId}`, error);

        socket.emit('error', {
          jobId,
          message: error instanceof Error ? error.message : '다운로드에 실패했습니다',
        });

        jobs.set(jobId, { outputPath: null, status: 'failed' });
      }
    });
  });

  io.getJob = (jobId: string) => jobs.get(jobId);
  io.deleteJob = (jobId: string) => jobs.delete(jobId);
};
