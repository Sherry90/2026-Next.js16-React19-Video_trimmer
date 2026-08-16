/**
 * Chzzk 클립 다운로드 (네이티브 chzzk API 경로).
 *
 * 클립은 chzzk가 progressive muxed MP4 한 파일로 제공하고 길이도 최대 ~90초라,
 * DASH byte-range 병렬 기계(video/audio 분리 + sidx 계획)를 쓸 이유가 없다.
 * 원본 전체를 한 번 받아 디스크에 쓴 뒤 공통 네이티브 트리머로 구간을 잘라낸다.
 *
 * 클립 타임라인은 0에서 시작하므로 streamlink 경로의 PTS 베이스라인 보정도 불필요하다.
 */

import { createWriteStream, existsSync, promises as fsPromises } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { getChzzkClipUid } from "@/shared/lib/platformUrl";
import { fetchChzzkClipInfo, pickClipSource } from "./chzzkClip";
import { trimAccurately } from "./accurateTrimmer";
import { reportServerError } from "./errorReport";
import {
  safeUnlink,
  ensureFileComplete,
  DownloadProgressTracker,
  type Job,
  type EventEmitter,
} from "./downloadTypes";
import { DOWNLOAD } from "@/constants/appConfig";

/**
 * 원본 MP4를 통째로 임시 파일에 내려받는다.
 *
 * CDN이 URL의 hdnts 토큰으로 인증하므로 추가 헤더가 필요 없다. wall 타임아웃 대신
 * 정체(stall) 감시만 둔다 — 다운로드 정책은 프로젝트 전반과 동일.
 */
async function downloadFullClip(
  url: string,
  outputPath: string,
  onProgress: (percent: number) => void,
  abortSignal?: AbortSignal,
): Promise<void> {
  const res = await fetch(url, { signal: abortSignal });
  if (!res.ok || !res.body) {
    throw new Error(`클립 원본을 받을 수 없습니다 (HTTP ${res.status})`);
  }

  const totalBytes = Number(res.headers.get("content-length") ?? 0);
  let received = 0;
  let lastAdvance = Date.now();

  const stallController = new AbortController();
  const stallTimer = setInterval(() => {
    if (Date.now() - lastAdvance > DOWNLOAD.STALL_TIMEOUT_MS) stallController.abort();
  }, 10_000);

  const source = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
  source.on("data", (chunk: Buffer) => {
    received += chunk.length;
    lastAdvance = Date.now();
    if (totalBytes > 0) onProgress(Math.min(100, (received / totalBytes) * 100));
  });

  const signals = [stallController.signal, ...(abortSignal ? [abortSignal] : [])];

  try {
    await pipeline(source, createWriteStream(outputPath), { signal: AbortSignal.any(signals) });
  } catch (error) {
    safeUnlink(outputPath);
    if (stallController.signal.aborted) {
      throw new Error("다운로드가 정체되었습니다 (네트워크를 확인해주세요)");
    }
    throw error;
  } finally {
    clearInterval(stallTimer);
  }

  if (totalBytes > 0 && received !== totalBytes) {
    safeUnlink(outputPath);
    throw new Error(`클립 원본이 잘렸습니다 (예상 ${totalBytes}, 수신 ${received})`);
  }
}

export async function downloadChzzkClip(
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
  const sourcePath = join(tmpdir(), `clipsrc_${jobId}.mp4`);
  const segmentDuration = endTime - startTime;
  const tracker = new DownloadProgressTracker(jobId, emitEvent, segmentDuration, "downloading");

  try {
    const clipUid = getChzzkClipUid(url);
    if (!clipUid) throw new Error("치지직 클립 URL이 아닙니다");

    tracker.emitProgress("downloading", true);

    // resolve 때 받은 URL은 만료(hdnts)됐을 수 있으므로 재조회한다.
    const info = await fetchChzzkClipInfo(clipUid);
    const source = pickClipSource(info.sources, maxHeight);

    await downloadFullClip(
      source.url,
      sourcePath,
      (percent) => tracker.updateProgress(percent, "downloading"),
      abortSignal,
    );

    tracker.resetForPhase("processing");
    tracker.emitProgress("processing", true);

    await trimAccurately({
      inputPath: sourcePath,
      outputPath,
      startTime,
      duration: segmentDuration,
      seekMode: "input", // 인덱스 있는 MP4 + 타임라인 0 기준 → 입력 seek로 충분
      abortSignal,
      onProgress: (percent) => tracker.updateProgress(percent, "processing"),
    });

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
  } catch (error) {
    safeUnlink(outputPath);
    const report = reportServerError("chzzk clip download", error, { jobId });
    updateJobStatus(jobId, {
      outputPath: null,
      status: "failed",
      errorMessage: report.userMessage,
      errorCode: report.code,
      errorDetails: report.cause,
    });
    tracker.emitError(report.userMessage, report.code, report.cause);
  } finally {
    safeUnlink(sourcePath);
  }
}
