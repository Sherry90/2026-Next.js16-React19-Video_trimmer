/**
 * Frame-accurate native FFmpeg trimming.
 *
 * Stream-copy cannot start at an arbitrary inter frame: FFmpeg must decode from
 * the preceding random-access point and discard frames until startTime.  This
 * module therefore always transcodes the selected interval. Indexed files use
 * fast input seek plus FFmpeg's default accurate-seek decode/discard step. Raw
 * concatenated HLS/TS instead decodes its short pre-roll before output seeking.
 */

import { spawn } from "child_process";
import { existsSync, promises as fsPromises } from "fs";
import { getFfmpegPath } from "./binPaths";
import { safeUnlink, ensureFileComplete } from "./downloadTypes";
import { runWithTimeout } from "./processUtils";
import { FFmpegProgressTracker } from "./progressParser";
import { PROCESS } from "@/constants/appConfig";

export interface AccurateTrimOptions {
  inputPath: string;
  outputPath: string;
  /** Seconds on the input file's own timeline. */
  startTime: number;
  duration: number;
  /** Raw concatenated HLS/TS has no reliable seek index; decode its short pre-roll from the start. */
  seekMode?: "input" | "output";
  abortSignal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export function buildAccurateFfmpegArgs(options: AccurateTrimOptions): string[] {
  const { inputPath, outputPath, startTime, duration, seekMode = "input" } = options;
  const seek = ["-ss", String(Math.max(0, startTime))];
  return [
    "-y",
    ...(seekMode === "input" ? seek : []),
    "-i",
    inputPath,
    ...(seekMode === "output" ? seek : []),
    "-t",
    String(duration),
    "-map",
    "0:v:0?",
    "-map",
    "0:a:0?",
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
    "-max_muxing_queue_size",
    "4096",
    "-progress",
    "pipe:2",
    "-nostats",
    outputPath,
  ];
}

function attachAbort(proc: ReturnType<typeof spawn>, signal?: AbortSignal): () => void {
  if (!signal) return () => {};
  const abort = () => {
    if (!proc.killed) proc.kill("SIGKILL");
  };
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  return () => signal.removeEventListener("abort", abort);
}

async function validateDecodedOutput(outputPath: string, duration: number): Promise<void> {
  const proc = spawn(
    getFfmpegPath(),
    ["-v", "error", "-i", outputPath, "-map", "0:v:0?", "-map", "0:a:0?", "-f", "null", "-"],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const ok = await runWithTimeout(proc, Math.max(PROCESS.FFMPEG_TIMEOUT_MS, duration * 2000));
  if (!ok) throw new Error("트리밍 결과를 다시 디코딩할 수 없습니다");
}

export async function trimAccurately(options: AccurateTrimOptions): Promise<void> {
  const { inputPath, outputPath, duration, abortSignal, onProgress } = options;
  if (!Number.isFinite(options.startTime) || options.startTime < 0) {
    throw new Error("시작 시간이 올바르지 않습니다");
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("트리밍 길이가 올바르지 않습니다");
  }
  if (!existsSync(inputPath)) throw new Error("입력 파일을 찾을 수 없습니다");
  if (abortSignal?.aborted) throw new Error("트리밍이 취소되었습니다");

  safeUnlink(outputPath);
  onProgress?.(0);

  const proc = spawn(getFfmpegPath(), buildAccurateFfmpegArgs(options), {
    stdio: ["ignore", "ignore", "pipe"],
  });
  const detachAbort = attachAbort(proc, abortSignal);
  const tracker = new FFmpegProgressTracker(duration);
  proc.stderr?.on("data", (chunk: Buffer) => onProgress?.(tracker.pushChunk(chunk)));

  try {
    const ok = await runWithTimeout(
      proc,
      Math.max(PROCESS.FFMPEG_TIMEOUT_MS, Math.ceil(duration * 10_000)),
    );
    if (!ok || abortSignal?.aborted || !existsSync(outputPath)) {
      throw new Error(
        abortSignal?.aborted ? "트리밍이 취소되었습니다" : "FFmpeg 트리밍에 실패했습니다",
      );
    }

    // 매우 짧거나 무음인 정상 MP4는 전역 다운로드 최소 크기(32KB)보다 작을 수 있다.
    await ensureFileComplete(outputPath, 5000, 12);
    const stat = await fsPromises.stat(outputPath);
    if (stat.size === 0) throw new Error("트리밍 결과가 비어 있습니다");
    await validateDecodedOutput(outputPath, duration);
    onProgress?.(100);
  } catch (error) {
    safeUnlink(outputPath);
    throw error;
  } finally {
    detachAbort();
  }
}
