/**
 * yt-dlp is used only to resolve metadata and expiring DASH representation URLs.
 * Media itself is always fetched through strict HTTP Range requests by
 * byteRangeDownloader; there is deliberately no full-download fallback.
 */

import { existsSync, promises as fsPromises } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getYtdlpPath } from "./binPaths";
import { DOWNLOAD } from "@/constants/appConfig";
import { downloadClipByteRange } from "./byteRangeDownloader";
import { reportServerError } from "./errorReport";
import {
  safeUnlink,
  ensureFileComplete,
  DownloadProgressTracker,
  type Job,
  type EventEmitter,
} from "./downloadTypes";

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
  abortSignal?: AbortSignal,
): Promise<void> {
  const { url, startTime, endTime, filename, maxHeight } = params;
  const outputPath = join(tmpdir(), `download_${jobId}.mp4`);
  const segmentDuration = endTime - startTime;
  const tracker = new DownloadProgressTracker(jobId, emitEvent, segmentDuration, "downloading");
  let processingStarted = false;

  try {
    if (!getYtdlpPath()) throw new Error("yt-dlp이 설치되어 있지 않습니다");

    tracker.emitProgress("downloading", true);
    await downloadClipByteRange(
      { jobId, url, startTime, endTime, outputPath, maxHeight },
      abortSignal,
      (progress) => tracker.updateProgress(progress, "downloading"),
      (progress) => {
        if (!processingStarted) {
          processingStarted = true;
          tracker.resetForPhase("processing");
          tracker.emitProgress("processing", true);
        }
        tracker.updateProgress(progress, "processing");
      },
    );

    if (!existsSync(outputPath)) throw new Error("구간 추출에 실패했습니다");
    const stats = await fsPromises.stat(outputPath);
    if (stats.size < DOWNLOAD.MIN_VALID_FILE_SIZE) {
      throw new Error("추출된 파일이 손상되었습니다 (파일 크기가 너무 작음)");
    }
    await ensureFileComplete(outputPath);

    updateJobStatus(jobId, { outputPath, status: "completed" });
    tracker.setCurrentPhase("completed");
    tracker.emitProgress("completed", true);
    tracker.emitComplete(filename || "video.mp4");
    const resources = process.getActiveResourcesInfo?.() ?? [];
    console.log(
      `[download] ✅ DONE ${jobId} — activeResources=${resources.length} timers=${resources.filter((type) => type === "Timeout").length}`,
    );
  } catch (error) {
    safeUnlink(outputPath);
    const report = reportServerError("DASH partial download", error, { jobId });
    updateJobStatus(jobId, {
      outputPath: null,
      status: "failed",
      errorMessage: report.userMessage,
      errorCode: report.code,
      errorDetails: report.cause,
    });
    tracker.emitError(report.userMessage, report.code, report.cause);
  }
}
