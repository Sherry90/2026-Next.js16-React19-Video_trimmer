/**
 * DASH single-file partial downloader.
 *
 * Only the 128 KiB init/sidx probe is buffered in memory. Selected media ranges
 * are split into fixed-size requests and streamed directly into sparse temporary
 * files. A server which does not honour byte ranges is never allowed to fall
 * back to a full response.
 */

import { execFile, spawn } from "child_process";
import { promises as fsPromises } from "fs";
import type { FileHandle } from "fs/promises";
import { promisify } from "util";
import { getFfmpegPath, getYtdlpPath } from "./binPaths";
import { runWithTimeout } from "./processUtils";
import { PROCESS, DOWNLOAD } from "@/constants/appConfig";
import { selectDashFormats } from "./formatSelector";
import {
  parseInitIndexRange,
  parseSidx,
  computeClipByteRange,
  DASH_HEAD_BYTES,
} from "./dashManifest";

const execFileAsync = promisify(execFile);
const PARTIAL_DOWNLOAD_MESSAGE =
  "이 영상은 부분 다운로드를 지원하지 않아 전체 다운로드 없이 처리할 수 없습니다";

export class PartialDownloadUnavailableError extends Error {
  constructor(details: string) {
    super(`${PARTIAL_DOWNLOAD_MESSAGE}: ${details}`);
    this.name = "PartialDownloadUnavailableError";
  }
}

class RetryableRangeError extends Error {
  constructor(details: string) {
    super(`Range 다운로드 실패: ${details}`);
    this.name = "RetryableRangeError";
  }
}

interface ContentRange {
  start: number;
  end: number;
  total: number;
}

export interface ByteRange {
  start: number;
  end: number;
}

interface StrictRangeResponse {
  response: Response;
  range: ContentRange;
  expectedBytes: number;
  stopStallTimer: () => void;
  resetStallTimer: () => void;
  stalled: () => boolean;
}

export interface RepPlan {
  head: Buffer;
  init: [number, number];
  media: [number, number];
  clipStartTime: number;
  mediaBytes: number;
  sourceBytes: number;
  probeBytes: number;
}

export interface TransferCounters {
  receivedBytes: number;
  writtenBytes: number;
}

export interface ByteRangeDownloadStats {
  videoRange: [number, number];
  audioRange: [number, number];
  plannedBytes: number;
  receivedBytes: number;
  sourceBytes: number;
  downloadMs: number;
  encodeMs: number;
  verifyMs: number;
}

export function splitByteRange(start: number, end: number, chunkBytes: number): ByteRange[] {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
    throw new Error(`잘못된 바이트 범위: ${start}-${end}`);
  }
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) {
    throw new Error(`잘못된 청크 크기: ${chunkBytes}`);
  }

  const chunks: ByteRange[] = [];
  for (let cursor = start; cursor <= end; cursor += chunkBytes) {
    chunks.push({ start: cursor, end: Math.min(end, cursor + chunkBytes - 1) });
  }
  return chunks;
}

function parseContentRange(value: string | null): ContentRange | null {
  const match = value?.match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
  if (!match) return null;
  const parsed = {
    start: Number(match[1]),
    end: Number(match[2]),
    total: Number(match[3]),
  };
  if (
    !Number.isSafeInteger(parsed.start) ||
    !Number.isSafeInteger(parsed.end) ||
    !Number.isSafeInteger(parsed.total) ||
    parsed.start < 0 ||
    parsed.end < parsed.start ||
    parsed.end >= parsed.total
  ) {
    return null;
  }
  return parsed;
}

async function cancelResponse(response: Response): Promise<void> {
  await response.body?.cancel().catch(() => {});
}

function isDiskFull(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === "ENOSPC";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
}

async function openStrictRange(
  url: string,
  requested: ByteRange,
  parentSignal?: AbortSignal,
): Promise<StrictRangeResponse> {
  if (parentSignal?.aborted) throw new Error("다운로드가 취소되었습니다");

  const controller = new AbortController();
  let didStall = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resetStallTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      didStall = true;
      controller.abort();
    }, DOWNLOAD.STALL_TIMEOUT_MS);
  };
  const stopStallTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  resetStallTimer();

  const signal = parentSignal
    ? AbortSignal.any([parentSignal, controller.signal])
    : controller.signal;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Range: `bytes=${requested.start}-${requested.end}`,
        "Accept-Encoding": "identity",
      },
      signal,
    });
  } catch (error) {
    stopStallTimer();
    if (parentSignal?.aborted) throw new Error("다운로드가 취소되었습니다");
    if (didStall) {
      throw new RetryableRangeError(
        `Range 다운로드가 ${DOWNLOAD.STALL_TIMEOUT_MS / 1000}초 동안 멈췄습니다`,
      );
    }
    throw new RetryableRangeError(error instanceof Error ? error.message : String(error));
  }

  resetStallTimer();
  if (response.status === 200) {
    stopStallTimer();
    await cancelResponse(response);
    throw new PartialDownloadUnavailableError(
      "서버가 Range 요청에 200 OK 전체 응답을 반환했습니다",
    );
  }
  if (response.status !== 206) {
    stopStallTimer();
    await cancelResponse(response);
    const message = `Range 요청이 HTTP ${response.status}로 실패했습니다`;
    if (response.status === 429 || response.status >= 500) throw new RetryableRangeError(message);
    throw new Error(message);
  }

  const range = parseContentRange(response.headers.get("content-range"));
  if (!range) {
    stopStallTimer();
    await cancelResponse(response);
    throw new PartialDownloadUnavailableError("Content-Range가 없거나 올바르지 않습니다");
  }
  const expectedEnd = Math.min(requested.end, range.total - 1);
  if (range.start !== requested.start || range.end !== expectedEnd) {
    stopStallTimer();
    await cancelResponse(response);
    throw new PartialDownloadUnavailableError(
      `Content-Range 불일치 (요청 ${requested.start}-${requested.end}, 응답 ${range.start}-${range.end}/${range.total})`,
    );
  }

  const expectedBytes = range.end - range.start + 1;
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) !== expectedBytes) {
    stopStallTimer();
    await cancelResponse(response);
    throw new PartialDownloadUnavailableError(
      `Content-Length 불일치 (예상 ${expectedBytes}, 응답 ${contentLength})`,
    );
  }
  if (!response.body) {
    stopStallTimer();
    throw new RetryableRangeError("Range 응답 본문이 없습니다");
  }

  return {
    response,
    range,
    expectedBytes,
    stopStallTimer,
    resetStallTimer,
    stalled: () => didStall,
  };
}

async function readProbeRange(
  url: string,
  signal?: AbortSignal,
): Promise<{ buffer: Buffer; sourceBytes: number; receivedBytes: number }> {
  const opened = await openStrictRange(url, { start: 0, end: DASH_HEAD_BYTES - 1 }, signal);
  const reader = opened.response.body!.getReader();
  const buffer = Buffer.allocUnsafe(opened.expectedBytes);
  let received = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      if (item.value.byteLength === 0) continue;
      opened.resetStallTimer();
      received += item.value.byteLength;
      if (received > opened.expectedBytes) {
        throw new PartialDownloadUnavailableError("헤더 Range 응답이 요청한 크기보다 큽니다");
      }
      buffer.set(item.value, received - item.value.byteLength);
    }
    if (received !== opened.expectedBytes) {
      throw new RetryableRangeError(
        `헤더 Range 응답이 짧습니다 (예상 ${opened.expectedBytes}, 수신 ${received})`,
      );
    }
    return {
      buffer,
      sourceBytes: opened.range.total,
      receivedBytes: received,
    };
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (signal?.aborted) throw new Error("다운로드가 취소되었습니다");
    if (opened.stalled() || isAbortError(error)) {
      throw new RetryableRangeError("헤더 Range 다운로드가 정체되었습니다");
    }
    throw error;
  } finally {
    opened.stopStallTimer();
    reader.releaseLock();
  }
}

export async function planRep(
  url: string,
  startSec: number,
  endSec: number,
  signal?: AbortSignal,
): Promise<RepPlan> {
  let probe: Awaited<ReturnType<typeof readProbeRange>>;
  try {
    probe = await readProbeRange(url, signal);
  } catch (error) {
    if (error instanceof PartialDownloadUnavailableError || signal?.aborted) throw error;
    if (error instanceof RetryableRangeError) throw error;
    throw new PartialDownloadUnavailableError(
      error instanceof Error ? error.message : "DASH 헤더를 읽을 수 없습니다",
    );
  }

  try {
    const { init, index } = parseInitIndexRange(probe.buffer);
    const sidx = parseSidx(probe.buffer, index[0], index[1]);
    const { media, clipStartTime } = computeClipByteRange(sidx, init, startSec, endSec);
    return {
      head: probe.buffer,
      init,
      media,
      clipStartTime,
      mediaBytes: media[1] - media[0] + 1,
      sourceBytes: probe.sourceBytes,
      probeBytes: probe.receivedBytes,
    };
  } catch (error) {
    throw new PartialDownloadUnavailableError(
      error instanceof Error ? error.message : "DASH/sidx를 해석할 수 없습니다",
    );
  }
}

async function writeAll(file: FileHandle, data: Uint8Array, filePosition: number): Promise<void> {
  let offset = 0;
  while (offset < data.byteLength) {
    const result = await file.write(data, offset, data.byteLength - offset, filePosition + offset);
    if (result.bytesWritten <= 0) throw new Error("디스크 쓰기가 진행되지 않았습니다");
    offset += result.bytesWritten;
  }
}

async function downloadChunk(
  url: string,
  chunk: ByteRange,
  mediaStart: number,
  initBytes: number,
  expectedSourceBytes: number,
  file: FileHandle,
  counters: TransferCounters,
  onUniqueBytesWritten: (bytes: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const expected = chunk.end - chunk.start + 1;
  let credited = 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= DOWNLOAD.RANGE_MAX_RETRIES; attempt++) {
    if (signal?.aborted) throw new Error("다운로드가 취소되었습니다");
    let opened: StrictRangeResponse | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let received = 0;
    try {
      opened = await openStrictRange(url, chunk, signal);
      if (opened.expectedBytes !== expected) {
        throw new PartialDownloadUnavailableError(
          `미디어 Range 크기 불일치 (예상 ${expected}, 응답 ${opened.expectedBytes})`,
        );
      }
      if (opened.range.total !== expectedSourceBytes) {
        throw new PartialDownloadUnavailableError(
          `Content-Range 전체 크기 불일치 (예상 ${expectedSourceBytes}, 응답 ${opened.range.total})`,
        );
      }
      reader = opened.response.body!.getReader();
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        if (item.value.byteLength === 0) continue;
        opened.resetStallTimer();
        if (received + item.value.byteLength > expected) {
          throw new PartialDownloadUnavailableError("미디어 응답이 요청한 Range보다 큽니다");
        }
        await writeAll(file, item.value, initBytes + (chunk.start - mediaStart) + received);
        received += item.value.byteLength;
        counters.receivedBytes += item.value.byteLength;
        if (received > credited) {
          const unique = received - credited;
          credited = received;
          counters.writtenBytes += unique;
          onUniqueBytesWritten(unique);
        }
      }
      if (received !== expected) {
        throw new RetryableRangeError(
          `Range 응답이 짧습니다 (${chunk.start}-${chunk.end}, 예상 ${expected}, 수신 ${received})`,
        );
      }
      return;
    } catch (error) {
      lastError = error;
      await reader?.cancel().catch(() => {});
      if (
        signal?.aborted ||
        error instanceof PartialDownloadUnavailableError ||
        isDiskFull(error)
      ) {
        throw error;
      }
      const retryable = error instanceof RetryableRangeError || isAbortError(error);
      if (!retryable || attempt === DOWNLOAD.RANGE_MAX_RETRIES) throw error;
      console.warn(
        `[byte-range] retry ${attempt + 1}/${DOWNLOAD.RANGE_MAX_RETRIES} for ${chunk.start}-${chunk.end}: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      opened?.stopStallTimer();
      reader?.releaseLock();
    }
  }
  throw lastError;
}

export async function writeRepClip(
  url: string,
  plan: RepPlan,
  outFile: string,
  counters: TransferCounters,
  onUniqueBytesWritten: (bytes: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const init = plan.head.subarray(plan.init[0], plan.init[1] + 1);
  let file: FileHandle | undefined;
  try {
    file = await fsPromises.open(outFile, "w+");
    await file.truncate(init.byteLength + plan.mediaBytes);
    await writeAll(file, init, 0);
    counters.writtenBytes += init.byteLength;
    onUniqueBytesWritten(init.byteLength);

    const chunks = splitByteRange(plan.media[0], plan.media[1], DOWNLOAD.RANGE_CHUNK_BYTES);
    let nextChunk = 0;
    const workerController = new AbortController();
    const workerSignal = signal
      ? AbortSignal.any([signal, workerController.signal])
      : workerController.signal;
    let firstWorkerError: unknown;
    const workers = Array.from(
      { length: Math.min(DOWNLOAD.RANGE_CONCURRENCY_PER_REP, chunks.length) },
      async () => {
        while (true) {
          const index = nextChunk++;
          if (index >= chunks.length) return;
          try {
            await downloadChunk(
              url,
              chunks[index],
              plan.media[0],
              init.byteLength,
              plan.sourceBytes,
              file!,
              counters,
              onUniqueBytesWritten,
              workerSignal,
            );
          } catch (error) {
            firstWorkerError ??= error;
            workerController.abort();
            throw error;
          }
        }
      },
    );
    const workerResults = await Promise.allSettled(workers);
    const workerFailure = workerResults.some((result) => result.status === "rejected");
    if (workerFailure) throw firstWorkerError;
    await file.sync();
    const stat = await file.stat();
    const expectedFileBytes = init.byteLength + plan.mediaBytes;
    if (stat.size !== expectedFileBytes) {
      throw new Error(`임시 파일 크기 불일치 (예상 ${expectedFileBytes}, 실제 ${stat.size})`);
    }
  } catch (error) {
    await file?.close().catch(() => {});
    file = undefined;
    await fsPromises.unlink(outFile).catch(() => {});
    throw error;
  } finally {
    await file?.close().catch(() => {});
  }
}

async function runFfmpeg(args: string[], timeoutMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new Error("다운로드가 취소되었습니다");
  const proc = spawn(getFfmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
  const abort = () => {
    if (!proc.killed) proc.kill("SIGKILL");
  };
  signal?.addEventListener("abort", abort, { once: true });
  let stderr = "";
  proc.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-30_000);
  });
  try {
    const ok = await runWithTimeout(proc, timeoutMs);
    if (!ok || signal?.aborted) {
      const tail = stderr.split("\n").filter(Boolean).slice(-3).join(" ").slice(-500);
      throw new Error(signal?.aborted ? "다운로드가 취소되었습니다" : `FFmpeg 실패: ${tail}`);
    }
  } finally {
    signal?.removeEventListener("abort", abort);
  }
}

async function encodeClip(
  videoFile: string,
  audioFile: string,
  outputPath: string,
  videoSeek: number,
  audioSeek: number,
  duration: number,
  signal?: AbortSignal,
): Promise<void> {
  await runFfmpeg(
    [
      "-y",
      "-ss",
      Math.max(0, videoSeek).toFixed(3),
      "-i",
      videoFile,
      "-ss",
      Math.max(0, audioSeek).toFixed(3),
      "-i",
      audioFile,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-t",
      String(duration),
      "-vf",
      "setpts=PTS-STARTPTS",
      "-af",
      "asetpts=PTS-STARTPTS",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    Math.max(PROCESS.FFMPEG_TIMEOUT_MS, Math.ceil(duration * 10_000)),
    signal,
  );
}

async function verifyDecodedOutput(
  outputPath: string,
  duration: number,
  signal?: AbortSignal,
): Promise<void> {
  await runFfmpeg(
    ["-v", "error", "-i", outputPath, "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-"],
    Math.max(PROCESS.FFMPEG_TIMEOUT_MS, Math.ceil(duration * 2_000)),
    signal,
  );
}

/**
 * Downloads and exports a URL clip exclusively through strict DASH Range requests.
 */
export async function downloadClipByteRange(
  params: {
    jobId: string;
    url: string;
    startTime: number;
    endTime: number;
    outputPath: string;
    maxHeight?: number;
  },
  signal: AbortSignal | undefined,
  reportDownloadProgress: (percent: number) => void,
  reportProcessingProgress?: (percent: number) => void,
): Promise<ByteRangeDownloadStats> {
  const { jobId, url, startTime, endTime, outputPath, maxHeight } = params;
  const ytdlp = getYtdlpPath();
  if (!ytdlp) throw new Error("yt-dlp이 설치되어 있지 않습니다");
  if (signal?.aborted) throw new Error("다운로드가 취소되었습니다");

  const pipelineStarted = performance.now();
  reportDownloadProgress(0);
  const { stdout: metaJson } = await execFileAsync(
    ytdlp,
    ["-J", "--no-playlist", "--ffmpeg-location", getFfmpegPath(), url],
    { timeout: 60_000, maxBuffer: 50 * 1024 * 1024, signal },
  );
  const info = JSON.parse(metaJson);
  const selection = selectDashFormats(info as never, maxHeight && maxHeight > 0 ? maxHeight : 1080);
  if (!selection || selection.video.length === 0) {
    throw new PartialDownloadUnavailableError("DASH(avc1 비디오 + mp4a 오디오) 표현이 없습니다");
  }
  const video = selection.video[selection.video.length - 1];
  const audio = selection.audio;

  const videoFile = `${outputPath}.v.mp4`;
  const audioFile = `${outputPath}.a.mp4`;
  const counters: TransferCounters = { receivedBytes: 0, writtenBytes: 0 };
  let downloadMs = 0;
  let encodeMs = 0;
  let verifyMs = 0;

  try {
    const [videoPlan, audioPlan] = await Promise.all([
      planRep(video.url, startTime, endTime, signal),
      planRep(audio.url, startTime, endTime, signal),
    ]);
    counters.receivedBytes += videoPlan.probeBytes + audioPlan.probeBytes;

    const videoInitBytes = videoPlan.init[1] - videoPlan.init[0] + 1;
    const audioInitBytes = audioPlan.init[1] - audioPlan.init[0] + 1;
    const plannedBytes =
      videoInitBytes + videoPlan.mediaBytes + audioInitBytes + audioPlan.mediaBytes;
    let uniqueWritten = 0;
    const onUniqueBytesWritten = (bytes: number) => {
      uniqueWritten += bytes;
      reportDownloadProgress((uniqueWritten / plannedBytes) * 100);
    };

    const downloadStarted = performance.now();
    const transferController = new AbortController();
    const transferSignal = signal
      ? AbortSignal.any([signal, transferController.signal])
      : transferController.signal;
    let firstTransferError: unknown;
    const runRep = async (repUrl: string, plan: RepPlan, path: string) => {
      try {
        await writeRepClip(repUrl, plan, path, counters, onUniqueBytesWritten, transferSignal);
      } catch (error) {
        firstTransferError ??= error;
        transferController.abort();
        throw error;
      }
    };
    const transferResults = await Promise.allSettled([
      runRep(video.url, videoPlan, videoFile),
      runRep(audio.url, audioPlan, audioFile),
    ]);
    const transferFailure = transferResults.some((result) => result.status === "rejected");
    if (transferFailure) throw firstTransferError;
    downloadMs = performance.now() - downloadStarted;
    if (counters.writtenBytes !== plannedBytes || uniqueWritten !== plannedBytes) {
      throw new Error(
        `디스크 기록 바이트 불일치 (계획 ${plannedBytes}, 실제 ${counters.writtenBytes})`,
      );
    }
    reportDownloadProgress(100);

    reportProcessingProgress?.(0);
    const encodeStarted = performance.now();
    await encodeClip(
      videoFile,
      audioFile,
      outputPath,
      startTime - videoPlan.clipStartTime,
      startTime - audioPlan.clipStartTime,
      endTime - startTime,
      signal,
    );
    encodeMs = performance.now() - encodeStarted;
    reportProcessingProgress?.(90);

    const verifyStarted = performance.now();
    await verifyDecodedOutput(outputPath, endTime - startTime, signal);
    verifyMs = performance.now() - verifyStarted;
    reportProcessingProgress?.(100);

    const sourceBytes = videoPlan.sourceBytes + audioPlan.sourceBytes;
    const ratio = sourceBytes > 0 ? (counters.receivedBytes / sourceBytes) * 100 : 0;
    const stats: ByteRangeDownloadStats = {
      videoRange: videoPlan.media,
      audioRange: audioPlan.media,
      plannedBytes,
      receivedBytes: counters.receivedBytes,
      sourceBytes,
      downloadMs,
      encodeMs,
      verifyMs,
    };
    console.log(
      `[byte-range] ${jobId} ${video.height}p ranges=v:${videoPlan.media[0]}-${videoPlan.media[1]},a:${audioPlan.media[0]}-${audioPlan.media[1]} planned=${plannedBytes} received=${counters.receivedBytes} ratio=${ratio.toFixed(2)}% download=${downloadMs.toFixed(0)}ms encode=${encodeMs.toFixed(0)}ms verify=${verifyMs.toFixed(0)}ms total=${(performance.now() - pipelineStarted).toFixed(0)}ms`,
    );
    return stats;
  } catch (error) {
    await fsPromises.unlink(outputPath).catch(() => {});
    throw error;
  } finally {
    await Promise.all([
      fsPromises.unlink(videoFile).catch(() => {}),
      fsPromises.unlink(audioFile).catch(() => {}),
    ]);
  }
}
