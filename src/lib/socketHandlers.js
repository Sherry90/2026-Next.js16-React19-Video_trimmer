const { spawn } = require('child_process');
const { unlinkSync, existsSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const { randomUUID } = require('crypto');
const { getFfmpegPath, getStreamlinkPath } = require('./binPaths.cjs');
const { formatTimeHHMMSS } = require('../features/timeline/utils/timeFormatter.cjs');
const {
  FFmpegProgressTracker,
  getFileDuration,
} = require('./progressParser');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function safeUnlink(path) {
  try {
    if (path && existsSync(path)) {
      unlinkSync(path);
    }
  } catch {
    // ignore cleanup errors
  }
}

/**
 * Socket.IO event handlers
 *
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
module.exports = function setupSocketHandlers(io) {
  // Job storage: jobId -> { outputPath, status }
  const jobs = new Map();

  // Global 객체에 jobs 저장 (API route에서 접근)
  global.__socketIO_jobs = jobs;

  io.on('connection', (socket) => {
    console.log('[Socket.IO] Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('[Socket.IO] Client disconnected:', socket.id);
    });

    /**
     * start-download 이벤트
     *
     * @param {Object} data
     * @param {string} data.url - 원본 URL
     * @param {number} data.startTime - 시작 시간 (초)
     * @param {number} data.endTime - 종료 시간 (초)
     * @param {string} data.filename - 파일명
     */
    socket.on('start-download', async (data) => {
      const { url, startTime, endTime, filename, tbr } = data;
      const jobId = randomUUID();
      const outputPath = join(tmpdir(), `download_${jobId}.mp4`);
      const tempFile = join(tmpdir(), `streamlink_temp_${jobId}.mp4`);

      console.log(`[Socket.IO] ========== NEW DOWNLOAD STARTED ==========`);
      console.log(`[Socket.IO] Job started: ${jobId}`);
      console.log(`[Socket.IO] URL: ${url}`);
      console.log(`[Socket.IO] Range: ${startTime}s - ${endTime}s`);
      console.log(`[Socket.IO] Code version: 2026-02-13-22:30`);

      jobs.set(jobId, { outputPath, status: 'running' });

      let processedSeconds = 0;
      let lastEmittedProgress = -1;
      let lastEmittedPhase = null;
      const segmentDuration = endTime - startTime;
      let totalSeconds = Math.max(1, segmentDuration);

      // 파일 크기 추정 (tbr이 없으면 기본값 2500 kbps 사용)
      const estimatedBitrate = tbr || 2500; // kbps
      const estimatedBytes = (estimatedBitrate * 1024 / 8) * segmentDuration; // bytes

      console.log(
        `[Socket.IO] Estimated file size: ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB ` +
        `(bitrate: ${estimatedBitrate} kbps, duration: ${segmentDuration}s)`
      );

      // Phase 추적 (stage 대신)
      let currentPhase = 'downloading'; // 'downloading' | 'processing' | 'completed'
      let lastLoggedProgress = -1; // 5% 단위 로그 출력용

      const computeProgress = () => {
        return clamp((processedSeconds / totalSeconds) * 100, 0, 100);
      };

      const emitProgress = (phase = 'downloading', force = false) => {
        const rawProgress = computeProgress();
        const roundedProgress = Math.round(rawProgress); // 정수로 표시

        // Integer percentage-based duplicate removal: only skip if rounded % hasn't changed
        // This ensures we emit on every 1% increment (smooth progress without flooding)
        if (
          !force &&
          roundedProgress === lastEmittedProgress &&
          phase === lastEmittedPhase
        ) {
          console.log(`[Socket.IO] Skipping duplicate: ${roundedProgress}% (last: ${lastEmittedProgress}%)`);
          return;
        }

        console.log(`[Socket.IO] Phase: ${phase}, Progress: ${roundedProgress}% (${processedSeconds.toFixed(2)}s)`);

        socket.emit('progress', {
          jobId,
          progress: roundedProgress, // ✅ 실제 0-100% (가중치 없음)
          processedSeconds: Number(processedSeconds.toFixed(2)),
          totalSeconds: Number(totalSeconds.toFixed(2)),
          phase: phase, // ✅ 'downloading' | 'processing' | 'completed'
        });

        lastEmittedProgress = roundedProgress; // Store rounded value for comparison
        lastEmittedPhase = phase;
      };

      // Streamlink progress: 0-100% (가중치 없음)
      const updateDownloadProgress = (progressPercent) => {
        // Phase 체크: downloading이 아니면 무시
        if (currentPhase !== 'downloading') {
          return;
        }

        const normalizedProgress = clamp(progressPercent, 0, 100);

        // 중복 방지: emitProgress에서 이미 처리하므로 여기서는 생략
        processedSeconds = (segmentDuration * normalizedProgress) / 100;
        emitProgress('downloading');
      };

      // FFmpeg progress: 0-100% (가중치 없음)
      const updateFFmpegProgress = (progressPercent) => {
        // Phase 체크: processing이 아니면 무시
        if (currentPhase !== 'processing') {
          console.log(
            `[Socket.IO] Ignoring ffmpeg progress ${progressPercent.toFixed(1)}% ` +
            `(current phase: ${currentPhase})`
          );
          return;
        }

        const normalizedProgress = clamp(progressPercent, 0, 100);
        const seconds = (segmentDuration * normalizedProgress) / 100;
        if (seconds <= processedSeconds) {
          return;
        }
        processedSeconds = seconds;
        emitProgress('processing');
      };

      try {
        if (typeof url !== 'string' || !url.trim()) {
          throw new Error('유효한 URL이 필요합니다');
        }
        if (
          typeof startTime !== 'number' ||
          typeof endTime !== 'number' ||
          endTime <= startTime
        ) {
          throw new Error('시작/종료 구간이 올바르지 않습니다');
        }

        const streamlinkBin = getStreamlinkPath();
        if (!streamlinkBin) {
          throw new Error('Streamlink이 설치되어 있지 않습니다');
        }

        const ffmpegPath = getFfmpegPath();

        emitProgress('downloading', true);

        // Phase 1: Streamlink download
        console.log(
          `[Socket.IO] Phase 1 (Downloading) - streamlink download: offset=${formatTimeHHMMSS(startTime)} duration=${formatTimeHHMMSS(segmentDuration)}`
        );
        emitProgress('downloading');

        const streamlinkArgs = [
          '--loglevel',
          'debug',
          '--progress=force',
          '--hls-start-offset',
          formatTimeHHMMSS(startTime),
          '--stream-segmented-duration',
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

        const streamlinkProc = spawn(streamlinkBin, streamlinkArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        // ========================================
        // FILE SIZE BASED PROGRESS TRACKING
        // ========================================

        let streamlinkStderr = '';

        // stderr 수집 (디버깅용)
        const onStreamlinkChunk = (chunk) => {
          streamlinkStderr += chunk.toString();
        };

        streamlinkProc.stderr?.on('data', onStreamlinkChunk);

        // 파일 크기 기반 progress polling (1초마다)
        const { promises: fsPromises } = require('fs');
        const progressInterval = setInterval(async () => {
          if (currentPhase !== 'downloading') {
            clearInterval(progressInterval);
            return;
          }

          try {
            const stats = await fsPromises.stat(tempFile);
            const downloadedBytes = stats.size;

            // Progress 계산
            const progress = Math.min(100, (downloadedBytes / estimatedBytes) * 100);

            updateDownloadProgress(progress);

            // 5% 단위로만 로그 출력
            const roundedProgress = Math.floor(progress / 5) * 5;
            if (roundedProgress % 5 === 0 && roundedProgress !== lastLoggedProgress) {
              console.log(
                `[Socket.IO] Downloaded: ${(downloadedBytes / 1024 / 1024).toFixed(1)} MB / ` +
                `${(estimatedBytes / 1024 / 1024).toFixed(1)} MB (${progress.toFixed(1)}%)`
              );
              lastLoggedProgress = roundedProgress;
            }
          } catch (err) {
            // 파일 아직 생성 안됨, 무시
          }
        }, 1000);

        const streamlinkSuccess = await new Promise((resolve) => {
          let settled = false;
          const settle = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            resolve(result);
          };

          const timeoutId = setTimeout(() => {
            streamlinkProc.kill('SIGKILL');
            settle(false);
          }, 300000);

          streamlinkProc.on('close', async (code) => {
            // Interval 정리
            clearInterval(progressInterval);

            // 이벤트 리스너 제거
            streamlinkProc.stderr?.removeAllListeners('data');

            console.log(`[Socket.IO] Streamlink closed`);
            console.log('[Socket.IO] Progress interval cleared');

            // 최종 파일 크기 확인
            try {
              const stats = await fsPromises.stat(tempFile);
              console.log(
                `[Socket.IO] Final file size: ${(stats.size / 1024 / 1024).toFixed(1)} MB ` +
                `(estimated: ${(estimatedBytes / 1024 / 1024).toFixed(1)} MB)`
              );
            } catch (err) {
              // ignore
            }

            // Save stderr for debugging
            const { writeFileSync } = require('fs');
            const debugPath = join(tmpdir(), `streamlink_debug_${jobId}.log`);
            try {
              writeFileSync(debugPath, streamlinkStderr, 'utf-8');
              console.log(`[Socket.IO] Stderr saved to: ${debugPath}`);
            } catch (err) {
              console.error('[Socket.IO] Failed to save stderr:', err);
            }

            if (code === 0 && existsSync(tempFile)) {
              settle(true);
            } else {
              console.error('[Socket.IO] Phase 1 failed:', streamlinkStderr);
              settle(false);
            }
          });

          streamlinkProc.on('error', (err) => {
            console.error('[Socket.IO] Streamlink spawn error:', err);
            settle(false);
          });
        });

        if (!streamlinkSuccess) {
          safeUnlink(tempFile);
          throw new Error('Streamlink 다운로드에 실패했습니다');
        }

        // Phase 1 완료: 실제 다운로드된 duration 확인
        const actualDownloadedDuration = await getFileDuration(tempFile);

        console.log(
          `[Socket.IO] Phase 1 (Downloading) completed` +
          ` - Actual duration: ${actualDownloadedDuration.toFixed(1)}s / ${segmentDuration}s`
        );

        // Phase 1 progress는 이미 segment 파싱으로 업데이트됨
        // updateDownloadProgress(100) 제거 - 갑자기 100% 점프 방지

        // Phase 전환: progress 리셋
        processedSeconds = 0;
        totalSeconds = segmentDuration; // FFmpeg 처리 시간
        currentPhase = 'processing';

        emitProgress('processing', true);

        // Phase 2: FFmpeg timestamp reset
        console.log('[Socket.IO] Phase 2 (Processing) - ffmpeg timestamp reset');
        emitProgress('processing');

        const ffmpegProc = spawn(
          ffmpegPath,
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
          {
            stdio: ['ignore', 'pipe', 'pipe'],
          }
        );

        // FFmpeg progress tracker
        const ffmpegTracker = new FFmpegProgressTracker(segmentDuration);
        let ffmpegStderr = '';

        let lastLoggedFFmpegProgress = -1;

        ffmpegProc.stderr?.on('data', (chunk) => {
          const text = chunk.toString();
          ffmpegStderr += text;

          // FFmpegProgressTracker로 실시간 파싱
          const ffmpegProgress = ffmpegTracker.pushChunk(chunk);
          updateFFmpegProgress(ffmpegProgress);

          // 로그 출력 (5% 간격으로만 출력)
          const processedSec = ffmpegTracker.getProcessedSeconds();
          const roundedProgress = Math.floor(ffmpegProgress / 5) * 5;
          if (processedSec > 0 && roundedProgress !== lastLoggedFFmpegProgress) {
            console.log(
              `[Socket.IO] FFmpeg time=${processedSec.toFixed(1)}s: ${ffmpegProgress.toFixed(1)}%`
            );
            lastLoggedFFmpegProgress = roundedProgress;
          }
        });

        const ffmpegSuccess = await new Promise((resolve) => {
          let settled = false;
          const settle = (result) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            resolve(result);
          };

          const timeoutId = setTimeout(() => {
            ffmpegProc.kill('SIGKILL');
            settle(false);
          }, 60000);

          ffmpegProc.on('close', (code) => {
            if (code === 0 && existsSync(outputPath)) {
              settle(true);
            } else {
              console.error('[Socket.IO] Stage 2 failed:', ffmpegStderr);
              settle(false);
            }
          });

          ffmpegProc.on('error', (err) => {
            console.error('[Socket.IO] FFmpeg spawn error:', err);
            settle(false);
          });
        });

        safeUnlink(tempFile);

        if (!ffmpegSuccess) {
          safeUnlink(outputPath);
          throw new Error('FFmpeg 처리에 실패했습니다');
        }

        // Phase 2 완료: 100%
        updateFFmpegProgress(100);
        console.log('[Socket.IO] Phase 2 (Processing) completed: 100%');
        currentPhase = 'completed';
        emitProgress('completed', true);

        socket.emit('complete', {
          jobId,
          filename: filename || 'video.mp4',
        });

        jobs.set(jobId, { outputPath, status: 'completed' });
        console.log(`[Socket.IO] Job completed: ${jobId}`);
      } catch (error) {
        safeUnlink(tempFile);
        safeUnlink(outputPath);
        console.error(`[Socket.IO] Job failed: ${jobId}`, error);
        const message =
          error instanceof Error ? error.message : '다운로드에 실패했습니다';

        socket.emit('error', {
          jobId,
          message,
        });

        jobs.set(jobId, { outputPath: null, status: 'failed' });
      }
    });
  });

  // Job 정보 조회 (API에서 사용)
  io.getJob = (jobId) => jobs.get(jobId);
  io.deleteJob = (jobId) => jobs.delete(jobId);
};
