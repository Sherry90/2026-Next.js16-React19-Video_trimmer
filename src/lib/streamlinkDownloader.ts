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
import { formatTime } from '@/shared/lib/timeFormatter';

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
    maxHeight?: number;
  },
  emitEvent: EventEmitter,
  updateJobStatus: (jobId: string, job: Partial<Job>) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  const { url, startTime, endTime, filename, tbr, maxHeight } = params;
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

    // 화질 우선순위: maxHeight 지정 시 "{h}p,best" (Streamlink가 첫 가용 항목 선택), 없으면 best.
    const qualitySpec = maxHeight && maxHeight > 0 ? `${maxHeight}p,best` : 'best';

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
      qualitySpec,
      '-o',
      tempFile,
    ];

    if (streamlinkBin.endsWith('.AppImage')) {
      streamlinkArgs.unshift('--appimage-extract-and-run');
    }

    const streamlinkProc = spawn(streamlinkBin, streamlinkArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    currentProc = streamlinkProc;
    let streamlinkStderr = '';
    // stall 감시용 liveness: tempFile이 커지거나 stderr가 올 때 갱신.
    let lastActivity = Date.now();
    let lastSize = 0;

    streamlinkProc.stderr?.on('data', (chunk: Buffer) => {
      lastActivity = Date.now();
      streamlinkStderr = (streamlinkStderr + chunk.toString()).slice(-50_000);
    });

    const progressInterval = setInterval(async () => {
      if (tracker.getCurrentPhase() !== 'downloading') {
        clearInterval(progressInterval);
        return;
      }

      try {
        const stats = await fsPromises.stat(tempFile);
        if (stats.size > lastSize) {
          lastSize = stats.size;
          lastActivity = Date.now(); // 파일이 자라는 중 = 진행 중
        }
        const progress = Math.min(100, (stats.size / estimatedBytes) * 100);
        tracker.updateProgress(progress, 'downloading');
      } catch {}
    }, POLLING.PROGRESS_CHECK_INTERVAL_MS);

    // 절대 시간 제한 없음. 대신 stall watchdog: STALL_TIMEOUT_MS 동안 파일 증가/출력이 전혀
    // 없으면 hang으로 보고 죽인다. (긴/느린 다운로드는 정상 — 디스크 직행 스트리밍이라 제한 무의미.)
    let stalled = false;
    const stallTimer = setInterval(() => {
      if (Date.now() - lastActivity > DOWNLOAD.STALL_TIMEOUT_MS) {
        stalled = true;
        streamlinkProc.kill('SIGKILL');
      }
    }, DOWNLOAD.STALL_CHECK_INTERVAL_MS);

    const result = await (async () => {
      const ok = await runWithTimeout(streamlinkProc, 0); // 0 = 절대 타임아웃 없음
      clearInterval(progressInterval);
      clearInterval(stallTimer);
      streamlinkProc.stderr?.removeAllListeners('data');
      currentProc = null;
      return ok && existsSync(tempFile);
    })();

    if (!result) {
      safeUnlink(tempFile);
      throw new Error(
        stalled
          ? `Streamlink 다운로드가 ${Math.round(DOWNLOAD.STALL_TIMEOUT_MS / 1000)}초간 멈춰 중단했습니다 (네트워크 끊김 등).`
          : 'Streamlink 다운로드에 실패했습니다'
      );
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
    // status를 emit보다 먼저 — emitComplete의 SSE cleanup 시점에 'running'이면 server.ts가
    // 불필요한 orphan-abort 타이머(30s)를 예약한다(잡마다 누적). status 먼저로 방지.
    updateJobStatus(jobId, { outputPath, status: 'completed' });
    tracker.updateProgress(100, 'processing');
    tracker.setCurrentPhase('completed');
    tracker.emitProgress('completed', true);
    tracker.emitComplete(filename || 'video.mp4');
  } catch (error) {
    safeUnlink(tempFile);
    safeUnlink(outputPath);
    console.error(`[SSE] Job failed: ${jobId}`, error);

    const errorMessage = error instanceof Error ? error.message : '다운로드에 실패했습니다';
    updateJobStatus(jobId, { outputPath: null, status: 'failed', errorMessage }); // status 먼저 → orphan 타이머 방지
    tracker.emitError(errorMessage);
  }
}
