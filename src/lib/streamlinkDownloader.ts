/**
 * Streamlink 기반 다운로드 (치지직 플랫폼)
 *
 * 2단계 프로세스:
 * 1. 요청점 이전 pre-roll을 Streamlink로 받고 실제 시작 PTS를 원본 기준으로 보정
 * 2. raw HLS/TS를 처음부터 디코딩해 요청 프레임에서 자른 뒤 H.264/AAC로 재인코딩
 */

import { spawn } from "child_process";
import { existsSync, promises as fsPromises } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getFfmpegPath, getStreamlinkPath } from "./binPaths";
import {
  safeUnlink,
  ensureFileComplete,
  DownloadProgressTracker,
  type Job,
  type EventEmitter,
} from "./downloadTypes";
import { reportServerError } from "./errorReport";
import { runWithTimeout, watchStall } from "./processUtils";
import { PROCESS, EXPORT, POLLING, DOWNLOAD } from "@/constants/appConfig";
import { formatTime } from "@/shared/lib/timeFormatter";
import { trimAccurately } from "./accurateTrimmer";

const HLS_PREROLL_SECONDS = 12;

/** 입력 타임스탬프를 보존한 채 첫 영상 프레임 PTS를 읽는다. */
async function probeFirstVideoPts(filePath: string): Promise<number | null> {
  const proc = spawn(
    getFfmpegPath(),
    [
      "-hide_banner",
      "-loglevel",
      "info",
      "-copyts",
      "-i",
      filePath,
      "-map",
      "0:v:0",
      "-frames:v",
      "1",
      "-vf",
      "showinfo",
      "-an",
      "-f",
      "null",
      "-",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  let stderr = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-100_000);
  });
  const ok = await runWithTimeout(proc, PROCESS.FFMPEG_TIMEOUT_MS);
  if (!ok) return null;
  const match = stderr.match(/\bpts_time:([+-]?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

async function captureHls(
  streamlinkBin: string,
  args: string[],
  outputPath: string,
  abortSignal?: AbortSignal,
): Promise<boolean> {
  safeUnlink(outputPath);
  const proc = spawn(streamlinkBin, [...args, "-o", outputPath], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  let lastActivity = Date.now();
  let lastSize = 0;
  proc.stderr?.on("data", () => {
    lastActivity = Date.now();
  });
  const activityTimer = setInterval(async () => {
    try {
      const stat = await fsPromises.stat(outputPath);
      if (stat.size > lastSize) {
        lastSize = stat.size;
        lastActivity = Date.now();
      }
    } catch {}
  }, POLLING.PROGRESS_CHECK_INTERVAL_MS);
  const stall = watchStall({
    getLastActivity: () => lastActivity,
    timeoutMs: DOWNLOAD.STALL_TIMEOUT_MS,
    checkIntervalMs: DOWNLOAD.STALL_CHECK_INTERVAL_MS,
    onStall: () => proc.kill("SIGKILL"),
  });
  abortSignal?.addEventListener(
    "abort",
    () => {
      if (!proc.killed) proc.kill("SIGKILL");
    },
    { once: true },
  );
  try {
    const ok = await runWithTimeout(proc, 0);
    return ok && !stall.stalled() && existsSync(outputPath);
  } finally {
    clearInterval(activityTimer);
    stall.stop();
  }
}

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
  abortSignal?: AbortSignal,
): Promise<void> {
  const { url, startTime, endTime, filename, tbr, maxHeight } = params;
  const outputPath = join(tmpdir(), `download_${jobId}.mp4`);
  const tempFile = join(tmpdir(), `streamlink_temp_${jobId}.mp4`);
  const baselineFile = join(tmpdir(), `streamlink_baseline_${jobId}.mp4`);

  const segmentDuration = endTime - startTime;
  const estimatedBitrate = tbr || EXPORT.DEFAULT_BITRATE_KBPS;
  const estimatedBytes = ((estimatedBitrate * 1024) / 8) * segmentDuration;

  const tracker = new DownloadProgressTracker(jobId, emitEvent, segmentDuration, "downloading");

  // 현재 실행 중인 자식 프로세스 추적 (abort 시 종료)
  let currentProc: ReturnType<typeof spawn> | null = null;

  abortSignal?.addEventListener("abort", () => {
    if (currentProc && !currentProc.killed) {
      currentProc.kill("SIGTERM");
      const proc = currentProc;
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, 2000);
    }
  });

  try {
    const streamlinkBin = getStreamlinkPath();
    if (!streamlinkBin) throw new Error("Streamlink이 설치되어 있지 않습니다");

    tracker.emitProgress("downloading", true);

    // 화질 우선순위: maxHeight 지정 시 "{h}p,best" (Streamlink가 첫 가용 항목 선택), 없으면 best.
    const qualitySpec = maxHeight && maxHeight > 0 ? `${maxHeight}p,best` : "best";

    // ===== PHASE 1: Streamlink 구간 다운로드 =====
    // Streamlink 8.x는 start offset을 정수로 바꾼 뒤 그 이후 HLS 세그먼트를 고른다.
    // 요청점보다 충분히 앞에서 받아 실제 첫 PTS를 기준으로 잔여 seek를 계산한다.
    const requestedDownloadStart = Math.max(0, startTime - HLS_PREROLL_SECONDS);
    const downloadStart = Math.floor(requestedDownloadStart);
    const downloadDuration = segmentDuration + (startTime - downloadStart) + HLS_PREROLL_SECONDS;
    const appImageArgs = streamlinkBin.endsWith(".AppImage") ? ["--appimage-extract-and-run"] : [];
    const buildCaptureArgs = (offset: number, duration: number) => [
      ...appImageArgs,
      "--loglevel",
      "debug",
      "--progress=force",
      "--hls-start-offset",
      formatTime(offset),
      "--hls-duration",
      formatTime(duration),
      "--stream-segment-threads",
      String(DOWNLOAD.STREAMLINK_SEGMENT_THREADS),
      url,
      qualitySpec,
    ];
    const streamlinkArgs = [...buildCaptureArgs(downloadStart, downloadDuration), "-o", tempFile];

    const streamlinkProc = spawn(streamlinkBin, streamlinkArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    currentProc = streamlinkProc;
    let streamlinkStderr = "";
    // stall 감시용 liveness: tempFile이 커지거나 stderr가 올 때 갱신.
    let lastActivity = Date.now();
    let lastSize = 0;

    streamlinkProc.stderr?.on("data", (chunk: Buffer) => {
      lastActivity = Date.now();
      streamlinkStderr = (streamlinkStderr + chunk.toString()).slice(-50_000);
    });

    const progressInterval = setInterval(async () => {
      if (tracker.getCurrentPhase() !== "downloading") {
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
        tracker.updateProgress(progress, "downloading");
      } catch {}
    }, POLLING.PROGRESS_CHECK_INTERVAL_MS);

    // 절대 시간 제한 없음. 대신 stall watchdog: STALL_TIMEOUT_MS 동안 파일 증가/출력이 전혀
    // 없으면 hang으로 보고 죽인다. (긴/느린 다운로드는 정상 — 디스크 직행 스트리밍이라 제한 무의미.)
    const stall = watchStall({
      getLastActivity: () => lastActivity,
      timeoutMs: DOWNLOAD.STALL_TIMEOUT_MS,
      checkIntervalMs: DOWNLOAD.STALL_CHECK_INTERVAL_MS,
      onStall: () => streamlinkProc.kill("SIGKILL"),
    });

    const result = await (async () => {
      const ok = await runWithTimeout(streamlinkProc, 0); // 0 = 절대 타임아웃 없음
      clearInterval(progressInterval);
      stall.stop();
      streamlinkProc.stderr?.removeAllListeners("data");
      currentProc = null;
      return ok && existsSync(tempFile);
    })();

    if (!result) {
      safeUnlink(tempFile);
      throw new Error(
        stall.stalled()
          ? `Streamlink 다운로드가 ${Math.round(DOWNLOAD.STALL_TIMEOUT_MS / 1000)}초간 멈춰 중단했습니다 (네트워크 끊김 등).`
          : "Streamlink 다운로드에 실패했습니다",
      );
    }

    // Phase 1→2 전환 중 abort 신호 확인 (레이스 컨디션 방지)
    if (abortSignal?.aborted) {
      safeUnlink(tempFile);
      throw new Error("다운로드가 취소되었습니다");
    }

    // Streamlink가 실제로 선택한 세그먼트의 원본 타임라인 위치를 계산한다.
    // offset=0 캡처의 첫 PTS와 본 캡처 첫 PTS 차이는 다운로드 시작점이다.
    let localStart = startTime;
    if (downloadStart > 0) {
      const baselineArgs = buildCaptureArgs(0, 1);
      const baselineOk = await captureHls(streamlinkBin, baselineArgs, baselineFile, abortSignal);
      const [baselinePts, clipPts] = baselineOk
        ? await Promise.all([probeFirstVideoPts(baselineFile), probeFirstVideoPts(tempFile)])
        : [null, null];
      safeUnlink(baselineFile);

      if (baselinePts !== null && clipPts !== null) {
        localStart = startTime - (clipPts - baselinePts);
      }

      // PTS가 discontinuity 등으로 신뢰 불가능하면 부정확한 결과를 내지 않고 0부터 다시 받는다.
      if (!Number.isFinite(localStart) || localStart < 0 || localStart > HLS_PREROLL_SECONDS * 3) {
        console.warn("[Streamlink] HLS PTS mapping unavailable; falling back to start-of-VOD");
        const fromZeroArgs = buildCaptureArgs(0, endTime + HLS_PREROLL_SECONDS);
        const fullOk = await captureHls(streamlinkBin, fromZeroArgs, tempFile, abortSignal);
        if (!fullOk) throw new Error("정확한 HLS 시작점을 확보하지 못했습니다");
        localStart = startTime;
      }
    }

    // ===== PHASE 2: 정확 seek + 선택 구간 재인코딩 =====
    tracker.resetForPhase("processing");
    tracker.emitProgress("processing", true);
    await trimAccurately({
      inputPath: tempFile,
      outputPath,
      startTime: localStart,
      duration: segmentDuration,
      seekMode: "output",
      abortSignal,
      onProgress: (progress) => tracker.updateProgress(progress, "processing"),
    });
    safeUnlink(tempFile);

    try {
      await ensureFileComplete(outputPath);
      console.log("[Streamlink] File write completed and verified:", outputPath);
    } catch {
      safeUnlink(outputPath);
      throw new Error("파일 쓰기 검증에 실패했습니다");
    }

    // ===== 완료 =====
    // status를 emit보다 먼저 — emitComplete의 SSE cleanup 시점에 'running'이면 server.ts가
    // 불필요한 orphan-abort 타이머(30s)를 예약한다(잡마다 누적). status 먼저로 방지.
    updateJobStatus(jobId, { outputPath, status: "completed" });
    tracker.updateProgress(100, "processing");
    tracker.setCurrentPhase("completed");
    tracker.emitProgress("completed", true);
    tracker.emitComplete(filename || "video.mp4");
  } catch (error) {
    safeUnlink(baselineFile);
    safeUnlink(tempFile);
    safeUnlink(outputPath);

    const report = reportServerError("streamlink download", error, { jobId });
    updateJobStatus(jobId, {
      outputPath: null,
      status: "failed",
      errorMessage: report.userMessage,
      errorCode: report.code,
      errorDetails: report.cause,
    }); // status 먼저 → orphan 타이머 방지
    tracker.emitError(report.userMessage, report.code, report.cause);
  }
}
