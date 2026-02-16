/**
 * yt-dlp 기반 다운로드 (유튜브 및 범용 플랫폼)
 *
 * 2단계 프로세스 (치지직과 동일):
 * 1. yt-dlp --download-sections → 임시 파일
 * 2. ffmpeg 타임스탬프 리셋 (-avoid_negative_ts make_zero)
 *
 * 공식 문서:
 * - https://gigazine.net/gsc_news/en/20220624-yt-dlp-download-sections/
 * - https://github.com/yt-dlp/yt-dlp
 */

import { spawn } from 'child_process';
import { unlinkSync, existsSync, promises as fsPromises } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FFmpegProgressTracker } from './progressParser';
import { getFfmpegPath, getYtdlpPath } from './binPaths';
import { runWithTimeout } from './processUtils';
import { PROCESS } from '@/constants/appConfig';
import { YtdlpProgressParser } from './progressParser';
import { buildYtdlpFormatSpec, DEFAULT_QUALITY } from './formatSelector';
import { clamp } from '@/utils/mathUtils';
import type { SSEProgressEvent, SSECompleteEvent, SSEErrorEvent } from '@/types/sse';

function safeUnlink(path: string): void {
  try {
    if (path && existsSync(path)) unlinkSync(path);
  } catch {}
}

// Server-side event types (extends SSE types with jobId)
type JobProgressEvent = SSEProgressEvent & { jobId: string; processedSeconds: number; totalSeconds: number };
type JobCompleteEvent = SSECompleteEvent & { jobId: string; filename: string };
type JobErrorEvent = SSEErrorEvent & { jobId: string };
type JobEvent = JobProgressEvent | JobCompleteEvent | JobErrorEvent;

export type JobListener = (event: JobEvent) => void;

export type Job = {
  outputPath: string | null;
  status: 'running' | 'completed' | 'failed';
  listeners: JobListener[];
};

// Export event emitter function type
export type EventEmitter = (jobId: string, event: JobEvent) => void;

/**
 * yt-dlp 명령어 인자 생성
 */
export function buildYtdlpArgs(params: {
  url: string;
  startTime: number;
  endTime: number;
  outputPath: string;
  quality?: '1080p' | 'best';
}): string[] {
  const { url, startTime, endTime, outputPath, quality = '1080p' } = params;

  // 시간 범위: 초 단위로 전달 (yt-dlp 권장)
  const timeRange = `*${startTime}-${endTime}`;

  // 화질 형식 지정자
  const formatSpec =
    quality === '1080p'
      ? buildYtdlpFormatSpec(DEFAULT_QUALITY) // 1080p 선호, fallback 허용
      : 'bv+ba/b'; // 최고 화질

  return [
    '--download-sections',
    timeRange,
    '-f',
    formatSpec,
    '-N',
    '6', // 병렬 다운로드 6개 스레드 (치지직과 동일)
    '--ffmpeg-location',
    getFfmpegPath(), // 번들된 FFmpeg 사용
    '--merge-output-format',
    'mp4', // 최종 출력을 mp4 컨테이너로 강제 (webm 확장자 추가 방지)
    '--no-playlist',
    '--newline', // 진행률 라인 버퍼링
    '-o',
    outputPath,
    url,
  ];
}

/**
 * yt-dlp 기반 다운로드 실행
 */
export async function downloadWithYtdlp(
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
  const { url, startTime, endTime, filename } = params;
  const outputPath = join(tmpdir(), `download_${jobId}.mp4`);
  const tempFile = join(tmpdir(), `ytdlp_temp_${jobId}.mp4`);

  const segmentDuration = endTime - startTime;
  let currentPhase: 'downloading' | 'processing' | 'completed' = 'downloading';

  let processedSeconds = 0;
  let lastEmittedProgress = -1;
  let lastEmittedPhase: string | null = null;
  let totalSeconds = Math.max(1, segmentDuration);

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
    const ytdlpBin = getYtdlpPath();
    if (!ytdlpBin) {
      throw new Error('yt-dlp이 설치되어 있지 않습니다');
    }

    console.log('[DEBUG] yt-dlp binary path:', ytdlpBin);

    // ===== PHASE 1: yt-dlp 구간 다운로드 =====
    console.log(
      `[SSE] Phase 1 (Downloading) - yt-dlp segment download (${startTime}s - ${endTime}s, duration: ${segmentDuration}s)`
    );

    emitProgress('downloading', true);

    const ytdlpArgs = buildYtdlpArgs({
      url,
      startTime,
      endTime,
      outputPath: tempFile,
      quality: '1080p',
    });

    console.log('[DEBUG] yt-dlp command:', ytdlpBin, ytdlpArgs.join(' '));
    console.log('[DEBUG] Full command array:', JSON.stringify(ytdlpArgs, null, 2));
    console.log('[DEBUG] Temp file path:', tempFile);
    console.log(`[SSE] yt-dlp command: ${ytdlpBin} ${ytdlpArgs.join(' ')}`);

    const ytdlpProc = spawn(ytdlpBin, ytdlpArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // stderr/stdout 전체 수집 (디버깅용)
    let stderrOutput = '';
    let stdoutOutput = '';

    const progressParser = new YtdlpProgressParser();
    const ytdlpFfmpegTracker = new FFmpegProgressTracker(segmentDuration); // yt-dlp 내부 FFmpeg 병합용
    let lastLoggedProgress = -1;

    // stdout과 stderr 모두에서 진행률 파싱 (yt-dlp는 둘 다 사용)
    const parseProgressLine = (line: string) => {
      // 1. yt-dlp의 [download] XX% 파싱 시도
      const ytdlpProgress = progressParser.parseLine(line);
      if (ytdlpProgress !== null) {
        updateProgress(ytdlpProgress, 'downloading');

        const rounded = Math.floor(ytdlpProgress / 5) * 5;
        if (rounded % 5 === 0 && rounded !== lastLoggedProgress) {
          console.log(`[SSE] yt-dlp progress: ${ytdlpProgress.toFixed(1)}%`);
          lastLoggedProgress = rounded;
        }
        return;
      }

      // 2. FFmpeg의 time=HH:MM:SS 파싱 시도 (yt-dlp 내부 병합)
      if (line.includes('frame=') && line.includes('time=')) {
        const ffmpegProgress = ytdlpFfmpegTracker.pushChunk(Buffer.from(line));
        if (ffmpegProgress > 0) {
          updateProgress(ffmpegProgress, 'downloading');

          const rounded = Math.floor(ffmpegProgress / 5) * 5;
          if (rounded % 5 === 0 && rounded !== lastLoggedProgress) {
            console.log(`[SSE] yt-dlp FFmpeg merge: ${ffmpegProgress.toFixed(1)}%`);
            lastLoggedProgress = rounded;
          }
        }
      }
    };

    ytdlpProc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutOutput += text;
      console.log('[DEBUG] yt-dlp stdout:', text.trim());

      const lines = text.split('\n');
      lines.forEach(parseProgressLine);
    });

    ytdlpProc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrOutput += text;
      console.log('[DEBUG] yt-dlp stderr:', text.trim());

      const lines = text.split('\n');
      lines.forEach(parseProgressLine);
    });

    ytdlpProc.on('error', (error) => {
      console.error('[DEBUG] yt-dlp process error:', error);
    });

    ytdlpProc.on('exit', (code, signal) => {
      console.log('[DEBUG] yt-dlp exit code:', code, 'signal:', signal);
    });

    const ytdlpSuccess = await runWithTimeout(ytdlpProc, PROCESS.YTDLP_TIMEOUT_MS);

    console.log('[DEBUG] runWithTimeout result:', ytdlpSuccess);
    console.log('[DEBUG] tempFile exists:', existsSync(tempFile));

    if (!ytdlpSuccess || !existsSync(tempFile)) {
      console.error('[DEBUG] yt-dlp FAILED');
      console.error('[DEBUG] stdout:', stdoutOutput);
      console.error('[DEBUG] stderr:', stderrOutput);
      throw new Error(`yt-dlp 다운로드에 실패했습니다\nstderr: ${stderrOutput.slice(-500)}`);
    }

    // 파일 크기 검증 (손상 방지)
    const stats = await fsPromises.stat(tempFile);
    console.log(`[SSE] yt-dlp completed: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

    if (stats.size < 1024) {
      // 1KB 미만
      throw new Error('다운로드된 파일이 손상되었습니다 (파일 크기가 너무 작음)');
    }

    // ===== PHASE 2: FFmpeg 타임스탬프 리셋 =====
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
        'copy', // 스트림 복사 (재인코딩 없음)
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

    const phase2FfmpegTracker = new FFmpegProgressTracker(segmentDuration);
    let lastFFmpegLog = -1;

    ffmpegProc.stderr?.on('data', (chunk: Buffer) => {
      const progress = phase2FfmpegTracker.pushChunk(chunk);
      updateProgress(progress, 'processing');

      const rounded = Math.floor(progress / 5) * 5;
      if (rounded !== lastFFmpegLog) {
        console.log(`[SSE] FFmpeg: ${phase2FfmpegTracker.getProcessedSeconds().toFixed(1)}s (${progress.toFixed(1)}%)`);
        lastFFmpegLog = rounded;
      }
    });

    const ffmpegSuccess = await runWithTimeout(ffmpegProc, PROCESS.FFMPEG_TIMEOUT_MS);

    safeUnlink(tempFile); // 임시 파일 정리

    if (!ffmpegSuccess || !existsSync(outputPath)) {
      safeUnlink(outputPath);
      throw new Error('FFmpeg 처리에 실패했습니다');
    }

    // ===== 완료 =====
    updateProgress(100, 'processing');
    console.log('[SSE] Phase 2 completed: 100%');
    currentPhase = 'completed';
    emitProgress('completed', true);

    emitEvent(jobId, {
      type: 'complete',
      jobId,
      filename: filename || 'video.mp4',
    });

    updateJobStatus(jobId, { outputPath, status: 'completed' });
    console.log(`[SSE] Job completed: ${jobId}`);
  } catch (error) {
    safeUnlink(tempFile);
    safeUnlink(outputPath);
    console.error(`[SSE] Job failed: ${jobId}`, error);

    const errorMessage = error instanceof Error ? error.message : 'yt-dlp 다운로드 중 오류가 발생했습니다';

    emitEvent(jobId, {
      type: 'error',
      jobId,
      message: errorMessage,
    });

    updateJobStatus(jobId, { outputPath: null, status: 'failed' });

    throw error;
  }
}
