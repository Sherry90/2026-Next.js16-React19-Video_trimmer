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
import { existsSync, promises as fsPromises } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FFmpegProgressTracker, YtdlpProgressParser } from './progressParser';
import { getFfmpegPath, getYtdlpPath } from './binPaths';
import { runWithTimeout } from './processUtils';
import { PROCESS, DOWNLOAD } from '@/constants/appConfig';
import { buildYtdlpFormatSpec, DEFAULT_QUALITY, QUALITY_PRESETS } from './formatSelector';
import { safeUnlink, ensureFileComplete, DownloadProgressTracker, type Job, type EventEmitter } from './downloadTypes';

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
    `aria2c:-x ${DOWNLOAD.ARIA2C_MAX_CONNECTIONS} -s ${DOWNLOAD.ARIA2C_SPLIT_COUNT} -k ${DOWNLOAD.ARIA2C_CHUNK_SIZE} --console-log-level=warn --summary-interval=0`,
    '-N',
    String(DOWNLOAD.YTDLP_CONCURRENT_FRAGMENTS),
    '--progress',
    '--newline',
    '--progress-template',
    'download:[download] %(progress.downloaded_bytes)s/%(progress.total_bytes)s at %(progress.speed)s ETA %(progress.eta)s',
    '--ffmpeg-location',
    getFfmpegPath(),
    '--merge-output-format',
    'mp4',
    '--postprocessor-args',
    'ffmpeg:-avoid_negative_ts make_zero -fflags +genpts -movflags +faststart',
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
  updateJobStatus: (jobId: string, job: Partial<Job>) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  const { url, startTime, endTime, filename } = params;
  const outputPath = join(tmpdir(), `download_${jobId}.mp4`);

  const segmentDuration = endTime - startTime;
  const tracker = new DownloadProgressTracker(jobId, emitEvent, segmentDuration, 'downloading');

  try {
    const ytdlpBin = getYtdlpPath();
    if (!ytdlpBin) {
      throw new Error('yt-dlp이 설치되어 있지 않습니다');
    }

    // ===== yt-dlp 구간 다운로드 + FFmpeg 후처리 (1단계) =====
    tracker.emitProgress('downloading', true);

    const ytdlpArgs = buildYtdlpArgs({
      url,
      startTime,
      endTime,
      outputPath,
    });

    const ytdlpProc = spawn(ytdlpBin, ytdlpArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    abortSignal?.addEventListener('abort', () => {
      if (!ytdlpProc.killed) {
        ytdlpProc.kill('SIGTERM');
        setTimeout(() => { if (!ytdlpProc.killed) ytdlpProc.kill('SIGKILL'); }, 2000);
      }
    }, { once: true });

    let stderrOutput = '';
    let stdoutOutput = '';

    const progressParser = new YtdlpProgressParser();
    const ytdlpFfmpegTracker = new FFmpegProgressTracker(segmentDuration);

    const parseProgressLine = (line: string) => {
      const ytdlpProgress = progressParser.parseLine(line);
      if (ytdlpProgress !== null) {
        tracker.updateProgress(ytdlpProgress, 'downloading');
        return;
      }

      if (line.includes('frame=') && line.includes('time=')) {
        const ffmpegProgress = ytdlpFfmpegTracker.pushChunk(Buffer.from(line));
        if (ffmpegProgress > 0) {
          tracker.updateProgress(ffmpegProgress, 'downloading');
        }
      }
    };

    ytdlpProc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdoutOutput += text;

      const lines = text.split('\n');
      lines.forEach(parseProgressLine);
    });

    ytdlpProc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrOutput += text;

      const lines = text.split('\n');
      lines.forEach(parseProgressLine);
    });

    ytdlpProc.on('error', (error) => {
      console.error('[yt-dlp] process error:', error);
    });

    const ytdlpSuccess = await runWithTimeout(ytdlpProc, PROCESS.YTDLP_TIMEOUT_MS);

    if (!ytdlpSuccess || !existsSync(outputPath)) {
      console.error('[yt-dlp] FAILED');
      console.error('[yt-dlp] stdout:', stdoutOutput);
      console.error('[yt-dlp] stderr:', stderrOutput);
      safeUnlink(outputPath);
      throw new Error(`yt-dlp 다운로드에 실패했습니다\nstderr: ${stderrOutput.slice(-500)}`);
    }

    // 파일 크기 검증 (손상 방지)
    const stats = await fsPromises.stat(outputPath);

    if (stats.size < DOWNLOAD.MIN_VALID_FILE_SIZE) {
      safeUnlink(outputPath);
      throw new Error('다운로드된 파일이 손상되었습니다 (파일 크기가 너무 작음)');
    }

    try {
      await ensureFileComplete(outputPath);
      console.log('[yt-dlp] File write completed and verified:', outputPath);
    } catch (error) {
      safeUnlink(outputPath);
      throw new Error('파일 쓰기 검증에 실패했습니다');
    }

    // ===== 완료 =====
    tracker.updateProgress(100, 'downloading');
    tracker.setCurrentPhase('completed');
    tracker.emitProgress('completed', true);
    tracker.emitComplete(filename || 'video.mp4');
    updateJobStatus(jobId, { outputPath, status: 'completed' });
  } catch (error) {
    safeUnlink(outputPath);
    console.error(`[SSE] Job failed: ${jobId}`, error);

    const errorMessage = error instanceof Error ? error.message : 'yt-dlp 다운로드 중 오류가 발생했습니다';
    tracker.emitError(errorMessage);
    updateJobStatus(jobId, { outputPath: null, status: 'failed', errorMessage });
  }
}
