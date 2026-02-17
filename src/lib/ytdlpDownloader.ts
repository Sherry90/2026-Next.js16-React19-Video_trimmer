/**
 * yt-dlp 기반 다운로드 (유튜브 및 범용 플랫폼)
 *
 * 1단계 프로세스 (최적화):
 * - yt-dlp --download-sections + --postprocessor-args → 최종 파일
 * - FFmpeg 옵션 (-avoid_negative_ts make_zero -movflags +faststart)을 postprocessor로 전달
 * - Phase 2 불필요, 파일 I/O 1회로 감소
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
import { buildYtdlpFormatSpec, DEFAULT_QUALITY, QUALITY_PRESETS } from './formatSelector';
import { clamp } from '@/utils/mathUtils';
import type { SSEProgressEvent, SSECompleteEvent, SSEErrorEvent } from '@/types/sse';

function safeUnlink(path: string): void {
  try {
    if (path && existsSync(path)) unlinkSync(path);
  } catch {}
}

/**
 * MP4 파일의 버퍼 플러시 완료 및 메타데이터 유효성 검증
 *
 * FFmpeg 프로세스 종료 후 OS 커널 버퍼가 디스크에 완전히 쓰여질 때까지 대기
 */
async function ensureFileComplete(filePath: string, timeoutMs = 5000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // 1. 파일 열기 시도 (read-only)
      const fd = await fsPromises.open(filePath, 'r');

      // 2. 파일 크기 확인
      const stats = await fd.stat();
      if (stats.size < 1024) {
        await fd.close();
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }

      // 3. MP4 ftyp header 읽기 (처음 12 bytes)
      const buffer = Buffer.allocUnsafe(12);
      await fd.read(buffer, 0, 12, 0);
      await fd.close();

      // 4. MP4 signature 검증
      // MP4 파일은 'ftyp' box로 시작 (offset 4-8)
      const signature = buffer.toString('ascii', 4, 8);
      if (signature === 'ftyp') {
        // 파일이 완전히 쓰여짐
        return;
      }

      // 5. signature 불완전 → 재시도
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      // 파일 아직 쓰기 중 또는 잠김 → 재시도
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw new Error(`File completion timeout: ${filePath}`);
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
  const { url, startTime, endTime, outputPath, quality = 'best' } = params;

  // 시간 범위: 초 단위로 전달 (yt-dlp 권장)
  const timeRange = `*${startTime}-${endTime}`;

  // 화질 형식 지정자
  const formatSpec =
    quality === '1080p'
      ? buildYtdlpFormatSpec(DEFAULT_QUALITY) // 1080p 선호, fallback 허용
      : buildYtdlpFormatSpec(QUALITY_PRESETS.BEST); // 최고 화질 (제한 없음)

  return [
    '--download-sections',
    timeRange,
    '-f',
    formatSpec,
    '--external-downloader',
    'aria2c',
    '--downloader-args',
    'aria2c:-x 16 -s 16 -k 1M --console-log-level=warn --summary-interval=0', // 16개 연결, 16개 분할, 1MB 청크, 로그 최소화
    '-N',
    '8', // 동시 다운로드 fragment 수
    '--progress',
    '--newline',
    '--progress-template',
    'download:[download] %(progress.downloaded_bytes)s/%(progress.total_bytes)s at %(progress.speed)s ETA %(progress.eta)s',
    '--ffmpeg-location',
    getFfmpegPath(), // 번들된 FFmpeg 사용
    '--merge-output-format',
    'mp4', // 최종 출력을 mp4 컨테이너로 강제 (webm 확장자 추가 방지)
    '--postprocessor-args',
    'ffmpeg:-avoid_negative_ts make_zero -fflags +genpts -movflags +faststart', // FFmpeg 옵션: timestamp 정규화 + 빠른 스트리밍
    '--no-playlist',
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

  const segmentDuration = endTime - startTime;
  let currentPhase: 'downloading' | 'completed' = 'downloading';

  let processedSeconds = 0;
  let lastEmittedProgress = -1;
  let lastEmittedPhase: string | null = null;
  let totalSeconds = Math.max(1, segmentDuration);

  const computeProgress = () => clamp((processedSeconds / totalSeconds) * 100, 0, 100);

  const emitProgress = (phase: 'downloading' | 'completed', force = false) => {
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
    if (seconds > processedSeconds) {
      processedSeconds = seconds;
      emitProgress(expectedPhase as 'downloading');
    }
  };

  try {
    const ytdlpBin = getYtdlpPath();
    if (!ytdlpBin) {
      throw new Error('yt-dlp이 설치되어 있지 않습니다');
    }

    // console.log('[DEBUG] yt-dlp binary path:', ytdlpBin);

    // ===== yt-dlp 구간 다운로드 + FFmpeg 후처리 (1단계) =====
    // console.log(
    //   `[SSE] yt-dlp download (${startTime}s - ${endTime}s, duration: ${segmentDuration}s)`
    // );

    emitProgress('downloading', true);

    const ytdlpArgs = buildYtdlpArgs({
      url,
      startTime,
      endTime,
      outputPath: outputPath, // 최종 파일로 직접 출력 (Phase 2 불필요)
      // quality 생략 시 기본값 'best' 사용 (최고 화질)
    });

    // console.log('[DEBUG] yt-dlp command:', ytdlpBin, ytdlpArgs.join(' '));
    // console.log('[DEBUG] Full command array:', JSON.stringify(ytdlpArgs, null, 2));
    // console.log('[DEBUG] Temp file path:', tempFile);
    // console.log(`[SSE] yt-dlp command: ${ytdlpBin} ${ytdlpArgs.join(' ')}`);

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

        // const rounded = Math.floor(ytdlpProgress / 5) * 5;
        // if (rounded % 5 === 0 && rounded !== lastLoggedProgress) {
        //   console.log(`[SSE] yt-dlp progress: ${ytdlpProgress.toFixed(1)}%`);
        //   lastLoggedProgress = rounded;
        // }
        return;
      }

      // 2. FFmpeg의 time=HH:MM:SS 파싱 시도 (yt-dlp 내부 병합)
      if (line.includes('frame=') && line.includes('time=')) {
        const ffmpegProgress = ytdlpFfmpegTracker.pushChunk(Buffer.from(line));
        if (ffmpegProgress > 0) {
          updateProgress(ffmpegProgress, 'downloading');

          // const rounded = Math.floor(ffmpegProgress / 5) * 5;
          // if (rounded % 5 === 0 && rounded !== lastLoggedProgress) {
          //   console.log(`[SSE] yt-dlp FFmpeg merge: ${ffmpegProgress.toFixed(1)}%`);
          //   lastLoggedProgress = rounded;
          // }
        }
      }
    };

    ytdlpProc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutOutput += text;
      // console.log('[DEBUG] yt-dlp stdout:', text.trim());

      const lines = text.split('\n');
      lines.forEach(parseProgressLine);
    });

    ytdlpProc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrOutput += text;
      // console.log('[DEBUG] yt-dlp stderr:', text.trim());

      const lines = text.split('\n');
      lines.forEach(parseProgressLine);
    });

    ytdlpProc.on('error', (error) => {
      console.error('[DEBUG] yt-dlp process error:', error);
    });

    ytdlpProc.on('exit', (code, signal) => {
      // console.log('[DEBUG] yt-dlp exit code:', code, 'signal:', signal);
    });

    const ytdlpSuccess = await runWithTimeout(ytdlpProc, PROCESS.YTDLP_TIMEOUT_MS);

    // console.log('[DEBUG] runWithTimeout result:', ytdlpSuccess);
    // console.log('[DEBUG] outputPath exists:', existsSync(outputPath));

    if (!ytdlpSuccess || !existsSync(outputPath)) {
      console.error('[DEBUG] yt-dlp FAILED');
      console.error('[DEBUG] stdout:', stdoutOutput);
      console.error('[DEBUG] stderr:', stderrOutput);
      safeUnlink(outputPath);
      throw new Error(`yt-dlp 다운로드에 실패했습니다\nstderr: ${stderrOutput.slice(-500)}`);
    }

    // 파일 크기 검증 (손상 방지)
    const stats = await fsPromises.stat(outputPath);
    // console.log(`[SSE] yt-dlp completed: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);

    if (stats.size < 1024) {
      // 1KB 미만
      safeUnlink(outputPath);
      throw new Error('다운로드된 파일이 손상되었습니다 (파일 크기가 너무 작음)');
    }

    // ✅ 파일 버퍼 플러시 완료 대기 (동기적 처리)
    try {
      await ensureFileComplete(outputPath);
      console.log('[yt-dlp] File write completed and verified:', outputPath);
    } catch (error) {
      safeUnlink(outputPath);
      throw new Error('파일 쓰기 검증에 실패했습니다');
    }

    // ===== 완료 =====
    updateProgress(100, 'downloading');
    // console.log('[SSE] yt-dlp completed: 100%');
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
