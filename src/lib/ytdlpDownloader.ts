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
import { YtdlpProgressParser } from './progressParser';
import { getFfmpegPath, getYtdlpPath, getAria2cPath } from './binPaths';
import { runWithTimeout, killProcessTree, watchStall } from './processUtils';
import { DOWNLOAD, PROCESS } from '@/constants/appConfig';
import { buildYtdlpFormatSpec, QUALITY_PRESETS } from './formatSelector';
import { downloadClipByteRange } from './byteRangeDownloader';
import { reportServerError } from './errorReport';
import { safeUnlink, ensureFileComplete, DownloadProgressTracker, type Job, type EventEmitter } from './downloadTypes';

/**
 * yt-dlp 명령어 인자 생성
 *
 * **--download-sections 안 씀.** 구간 추출은 yt-dlp가 ffmpeg로 직렬 처리해 ~112KB/s로 묶인다
 * (연결당 스로틀 + ffmpeg 병목, aria2c 무효). 대신 선택 포맷 **전체**를 aria2c 다중연결로 받아
 * (스로틀 우회 → ~4MB/s, 약 30배) 다운로드 후 로컬 ffmpeg로 구간 컷한다(buildFfmpegCutArgs).
 * outputPath는 컷 전 "전체 원본"이 떨어질 임시 경로다.
 */
export function buildYtdlpArgs(params: {
  url: string;
  outputPath: string;
  /** 최대 화질 height(px). 지정 시 그 이하 선호(fallback 허용), 미지정 시 최고 화질. */
  maxHeight?: number;
  /**
   * aria2c 실행 파일 경로. 주어지면 외부 다운로더로 써 다중연결 가속(~30배).
   * 미지정(번들/시스템 모두 없음)이면 외부 다운로더 인자를 생략해 yt-dlp 네이티브
   * 다운로더로 graceful 폴백한다 — 느리지만 죽지 않는다.
   */
  aria2cPath?: string | null;
}): string[] {
  const { url, outputPath, maxHeight, aria2cPath } = params;

  // 화질 형식 지정자: maxHeight 지정 시 그 이하 선호(없으면 최고), 미지정 시 제한 없는 최고 화질
  const formatSpec =
    maxHeight && maxHeight > 0
      ? buildYtdlpFormatSpec({ maxHeight, strictMode: false }) // 예: bestvideo[height<=?1080]+bestaudio/best
      : buildYtdlpFormatSpec(QUALITY_PRESETS.BEST); // 최고 화질 (제한 없음)

  // aria2c가 있으면 외부 다운로더로 가속, 없으면 두 인자 생략(네이티브 폴백).
  const aria2Args = aria2cPath
    ? [
        '--external-downloader',
        aria2cPath,
        '--downloader-args',
        `aria2c:-x ${DOWNLOAD.ARIA2C_MAX_CONNECTIONS} -s ${DOWNLOAD.ARIA2C_SPLIT_COUNT} -k ${DOWNLOAD.ARIA2C_CHUNK_SIZE} --console-log-level=warn --summary-interval=0`,
      ]
    : [];

  return [
    '-f',
    formatSpec,
    ...aria2Args,
    '-N',
    String(DOWNLOAD.YTDLP_CONCURRENT_FRAGMENTS),
    '--progress',
    '--newline',
    '--ffmpeg-location',
    getFfmpegPath(),
    '--merge-output-format',
    'mp4',
    '--no-playlist',
    '-o',
    outputPath,
    url,
  ];
}

/**
 * 로컬 구간 컷 ffmpeg 인자. 전체 원본(fullPath)에서 [startTime, startTime+duration]를
 * stream-copy로 잘라 outputPath(mp4)로. -ss를 -i 앞에 둬 빠른 키프레임 seek(±1-2s 정확도,
 * 기존과 동일), faststart로 moov를 앞으로(progressive 재생 가능).
 */
export function buildFfmpegCutArgs(
  fullPath: string,
  outputPath: string,
  startTime: number,
  duration: number
): string[] {
  return [
    '-y',
    '-ss',
    String(startTime),
    '-i',
    fullPath,
    '-t',
    String(duration),
    '-c',
    'copy',
    '-avoid_negative_ts',
    'make_zero',
    '-fflags',
    '+genpts',
    '-movflags',
    '+faststart',
    outputPath,
  ];
}

/**
 * 전체 원본에서 구간을 로컬 ffmpeg로 잘라낸다(stream-copy). abort 시 즉시 kill,
 * 실패 시 stderr에서 실제 원인 추출해 throw. 컷은 재인코딩 없어 보통 1초 미만.
 */
async function cutSection(
  fullPath: string,
  outputPath: string,
  startTime: number,
  duration: number,
  abortSignal?: AbortSignal
): Promise<void> {
  const args = buildFfmpegCutArgs(fullPath, outputPath, startTime, duration);
  const proc = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });

  abortSignal?.addEventListener(
    'abort',
    () => { if (!proc.killed) proc.kill('SIGKILL'); },
    { once: true }
  );

  let stderr = '';
  proc.stderr?.on('data', (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-50_000);
  });

  const ok = await runWithTimeout(proc, PROCESS.FFMPEG_TIMEOUT_MS);
  if (!ok) {
    throw new Error(`구간 추출(ffmpeg)에 실패했습니다: ${extractYtdlpError(stderr) || '알 수 없는 오류'}`);
  }
}

/**
 * yt-dlp/ffmpeg stderr에서 실제 에러만 추출한다.
 *
 * ffmpeg는 진행 상황을 stderr로 쏟아내(`frame=... size=... time=... bitrate=... speed=...`),
 * 마지막 N글자만 자르면 에러가 아니라 진행 로그가 잡혀 원인이 가려진다(`Error Code: UNKNOWN`).
 * 진행/다운로드 라인을 걸러내고 의미 있는 에러 라인만 남긴다.
 */
export function extractYtdlpError(stderr: string): string {
  const lines = stderr
    .split('\n')
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        !/^frame=/.test(l) && // ffmpeg 진행
        !/\bsize=\s*\S+\s+time=\S+\s+bitrate=/.test(l) && // ffmpeg 진행(변형)
        !/^\[download\]\s+\d/.test(l) && // yt-dlp 다운로드 퍼센트
        !/^[\d.]+x$/.test(l) && // 청크 경계로 잘린 speed 조각 (예: "1.97x")
        !/^(frame|fps|q|size|time|bitrate|speed)=/.test(l) // 잘린 진행 키 조각
    );

  // ERROR/HTTP/권한 등 신호 라인 우선, 없으면 마지막 비-진행 라인들
  const signal = lines.filter((l) =>
    /error|unable|unsupported|forbidden|http error|\b40[34]\b|fragment|giving up|not available|sign in/i.test(l)
  );
  const picked = (signal.length ? signal : lines).slice(-3).join(' ');
  return picked.slice(-500).trim();
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
    maxHeight?: number;
  },
  emitEvent: EventEmitter,
  updateJobStatus: (jobId: string, job: Partial<Job>) => void,
  abortSignal?: AbortSignal
): Promise<void> {
  const { url, startTime, endTime, filename, maxHeight } = params;
  // fullPath: 폴백(전체 다운) 임시 원본. outputPath: 최종 컷 결과(server.ts가 서빙).
  const fullPath = join(tmpdir(), `full_${jobId}.mp4`);
  const outputPath = join(tmpdir(), `download_${jobId}.mp4`);

  const segmentDuration = endTime - startTime;
  const tracker = new DownloadProgressTracker(jobId, emitEvent, segmentDuration, 'downloading');

  try {
    if (!getYtdlpPath()) {
      throw new Error('yt-dlp이 설치되어 있지 않습니다');
    }

    // ===== A) byte-range 우선: 구간 바이트만 받기 (긴 영상 짧은 클립에 큰 이득) =====
    let produced = false;
    try {
      tracker.emitProgress('downloading', true);
      await downloadClipByteRange(
        { jobId, url, startTime, endTime, outputPath, maxHeight },
        abortSignal,
        (p) => tracker.updateProgress(p, 'downloading')
      );
      produced = true;
    } catch (brErr) {
      safeUnlink(outputPath);
      // 잡 abort(취소/wall 타임아웃)면 폴백 금지 — 이미 abort된 signal은 폴백 프로세스의
      // kill 리스너를 발동 못 시켜 타임아웃이 무력화된다. 즉시 실패시킨다.
      if (abortSignal?.aborted) throw brErr;
      const m = brErr instanceof Error ? brErr.message : String(brErr);
      console.warn(`[yt-dlp] byte-range 불가 → 전체 다운로드 폴백: ${m}`);
      tracker.resetForPhase('downloading');
    }

    // ===== B) 폴백: 전체 포맷 aria2c 병렬 다운 + 로컬 컷 =====
    if (!produced) {
      await downloadFullThenCut(
        jobId,
        { url, startTime, segmentDuration, maxHeight, fullPath, outputPath },
        tracker,
        abortSignal
      );
    }

    // ===== 공통 완료 검증 =====
    if (!existsSync(outputPath)) {
      safeUnlink(outputPath);
      throw new Error('구간 추출에 실패했습니다');
    }
    const stats = await fsPromises.stat(outputPath);
    if (stats.size < DOWNLOAD.MIN_VALID_FILE_SIZE) {
      safeUnlink(outputPath);
      throw new Error('추출된 파일이 손상되었습니다 (파일 크기가 너무 작음)');
    }
    try {
      await ensureFileComplete(outputPath);
      console.log('[yt-dlp] File ready and verified:', outputPath);
    } catch {
      safeUnlink(outputPath);
      throw new Error('파일 쓰기 검증에 실패했습니다');
    }

    // ===== 완료 =====
    // status를 emit보다 먼저 'completed'로 — emitComplete가 SSE cleanup을 부르는데, 그 시점
    // status가 'running'이면 server.ts가 불필요한 orphan-abort 타이머(30s)를 예약한다(잡마다 누적).
    updateJobStatus(jobId, { outputPath, status: 'completed' });
    tracker.setCurrentPhase('completed');
    tracker.emitProgress('completed', true);
    tracker.emitComplete(filename || 'video.mp4');
    // 완료 마커 + 리소스 진단: 이 시점 이후 다운로드 백그라운드 작업 없음(자식 종료, orphan 타이머 미예약).
    // dev "Compiling…"은 Next/Turbopack 컴파일러(라우트 첫 히트·HMR)지 다운로드 아님.
    // timers 값이 잡마다 누적되면 타이머 누수 — 안정적이어야 정상.
    const res = process.getActiveResourcesInfo?.() ?? [];
    console.log(`[download] ✅ DONE ${jobId} — activeResources=${res.length} timers=${res.filter((t) => t === 'Timeout').length}`);
  } catch (error) {
    safeUnlink(fullPath);
    safeUnlink(outputPath);

    // 원시 원인을 분류해 구조화 리포트 생성·로그. 사용자에겐 친화 메시지, 상세는 stderr/원인.
    const report = reportServerError('yt-dlp download', error, { jobId });
    updateJobStatus(jobId, { outputPath: null, status: 'failed', errorMessage: report.userMessage, errorCode: report.code, errorDetails: report.cause }); // status 먼저 → orphan 타이머 방지
    tracker.emitError(report.userMessage, report.code, report.cause);
  }
}

/**
 * 폴백 경로: 선택 포맷 전체를 aria2c 병렬로 받아 로컬 ffmpeg로 구간 컷.
 * outputPath 생성(또는 throw)까지 책임. 완료 검증/이벤트는 호출부 공통 처리.
 */
async function downloadFullThenCut(
  jobId: string,
  args: {
    url: string;
    startTime: number;
    segmentDuration: number;
    maxHeight?: number;
    fullPath: string;
    outputPath: string;
  },
  tracker: DownloadProgressTracker,
  abortSignal?: AbortSignal
): Promise<void> {
  const { url, startTime, segmentDuration, maxHeight, fullPath, outputPath } = args;
  const ytdlpBin = getYtdlpPath();
  if (!ytdlpBin) throw new Error('yt-dlp이 설치되어 있지 않습니다');
  // 이미 abort된 signal로는 spawn 후 kill 리스너가 안 붙어 프로세스가 안 죽는다 → 시작 자체를 막는다.
  if (abortSignal?.aborted) throw new Error('다운로드가 취소되었습니다');

  tracker.emitProgress('downloading', true);
  // detached(POSIX): yt-dlp가 자기 프로세스 그룹의 리더가 됨. 그래야 외부 다운로더 aria2c(자식)까지
  // killProcessTree(음수 pid)로 한 번에 정리된다 (안 그러면 aria2c 고아 → 서버 잡아먹음).
  // Windows는 프로세스 그룹 개념이 달라(detached=새 콘솔) 끄고, killProcessTree가 taskkill /T로 정리.
  const ytdlpProc = spawn(
    ytdlpBin,
    buildYtdlpArgs({ url, outputPath: fullPath, maxHeight, aria2cPath: getAria2cPath() }),
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    },
  );

  abortSignal?.addEventListener('abort', () => {
    killProcessTree(ytdlpProc, 'SIGTERM');
    setTimeout(() => killProcessTree(ytdlpProc, 'SIGKILL'), 2000);
  }, { once: true });

  let stderrOutput = '';
  let lastActivity = Date.now();
  const progressParser = new YtdlpProgressParser();
  const onLine = (line: string) => {
    const p = progressParser.parseLine(line);
    if (p !== null) tracker.updateProgress(p, 'downloading');
  };
  ytdlpProc.stdout?.on('data', (chunk: Buffer) => {
    lastActivity = Date.now();
    chunk.toString().split('\n').forEach(onLine);
  });
  ytdlpProc.stderr?.on('data', (chunk: Buffer) => {
    lastActivity = Date.now();
    const text = chunk.toString();
    stderrOutput = (stderrOutput + text).slice(-50_000);
    text.split('\n').forEach(onLine);
  });
  ytdlpProc.on('error', (error) => console.error('[yt-dlp] process error:', error));

  const stall = watchStall({
    getLastActivity: () => lastActivity,
    timeoutMs: DOWNLOAD.STALL_TIMEOUT_MS,
    checkIntervalMs: DOWNLOAD.STALL_CHECK_INTERVAL_MS,
    onStall: () => {
      console.error(`[yt-dlp] stalled ${DOWNLOAD.STALL_TIMEOUT_MS}ms, killing`);
      killProcessTree(ytdlpProc); // aria2c 자식까지 정리
    },
  });

  let ok = false;
  try {
    ok = await runWithTimeout(ytdlpProc, 0); // 0 = 절대 타임아웃 없음(stall watchdog가 관리)
  } finally {
    stall.stop();
  }

  if (!ok || !existsSync(fullPath)) {
    console.error('[yt-dlp] FAILED stderr:', stderrOutput);
    safeUnlink(fullPath);
    const realError = extractYtdlpError(stderrOutput);
    const reason = stall.stalled()
      ? `다운로드가 ${Math.round(DOWNLOAD.STALL_TIMEOUT_MS / 1000)}초간 멈춰 중단했습니다 (네트워크 끊김 등).`
      : realError || '알 수 없는 오류';
    throw new Error(`yt-dlp 다운로드에 실패했습니다: ${reason}`);
  }

  const fullStats = await fsPromises.stat(fullPath);
  if (fullStats.size < DOWNLOAD.MIN_VALID_FILE_SIZE) {
    safeUnlink(fullPath);
    throw new Error('다운로드된 파일이 손상되었습니다 (파일 크기가 너무 작음)');
  }

  // 로컬 구간 컷 (stream-copy, 즉시)
  tracker.resetForPhase('processing');
  tracker.emitProgress('processing', true);
  await cutSection(fullPath, outputPath, startTime, segmentDuration, abortSignal);
  safeUnlink(fullPath);
}
