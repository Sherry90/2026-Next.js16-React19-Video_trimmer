import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { getFfmpegPath, getStreamlinkPath } from "@/lib/binPaths";

import { runWithTimeout } from "@/lib/processUtils";
import { formatTime } from "@/shared/lib/timeFormatter";
import { validateTrimRequest, handleApiError } from "@/lib/apiUtils";
import { streamFile } from "@/lib/streamUtils";
import { safeUnlink } from "@/lib/downloadTypes";

/**
 * Streamlink → ffmpeg two-stage trimming
 *
 * Reference: scripts/cut_video.sh (original shell script)
 * - streamlink --hls-start-offset --hls-duration
 * - ffmpeg -i temp.mp4 -c copy -avoid_negative_ts make_zero
 *
 * Stage 1: streamlink downloads segment to temp file
 * Stage 2: ffmpeg resets timestamps with copy codec
 *
 * Uses --hls-duration (실제 비디오 길이 기준)으로 구간을 추출한다.
 * (--stream-segmented-duration은 유효하지 않은 플래그 — Chzzk에서 무시됨.)
 */
async function trimWithStreamlink(
  originalUrl: string,
  startTime: number,
  endTime: number,
  outputPath: string,
): Promise<boolean> {
  const streamlinkBin = getStreamlinkPath();
  if (!streamlinkBin) {
    return false;
  }

  const duration = endTime - startTime;
  const ffmpegPath = getFfmpegPath();
  const tempFile = join(tmpdir(), `streamlink_temp_${randomUUID()}.mp4`);

  try {
    // Stage 1: Download segment with streamlink
    console.log(
      `[trim] Stage 1 - streamlink download: offset=${formatTime(startTime, false)} duration=${formatTime(duration, false)}`,
    );

    const args = [
      "--hls-start-offset",
      formatTime(startTime, false),
      "--hls-duration",
      formatTime(duration, false),
      "--stream-segment-threads",
      "6", // 병렬 다운로드 (1-10, 기본값 1)
      originalUrl,
      "best",
      "-o",
      tempFile,
    ];

    // Linux AppImage: FUSE 없는 환경 대응
    if (streamlinkBin.endsWith(".AppImage")) {
      args.unshift("--appimage-extract-and-run");
    }

    const streamlinkProc = spawn(streamlinkBin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const streamlinkSuccess = await runWithTimeout(streamlinkProc, {
      timeoutMs: 300000,
      logPrefix: "[trim] Stage 1 - streamlink download",
      onSuccess: (code) => code === 0 && existsSync(tempFile),
    });

    if (!streamlinkSuccess) {
      safeUnlink(tempFile);
      return false;
    }

    // Stage 2: Reset timestamps with ffmpeg
    console.log("[trim] Stage 2 - ffmpeg timestamp reset");

    const ffmpegProc = spawn(
      ffmpegPath,
      [
        "-y",
        "-i",
        tempFile,
        "-c",
        "copy",
        "-avoid_negative_ts",
        "make_zero",
        "-fflags",
        "+genpts",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const ffmpegSuccess = await runWithTimeout(ffmpegProc, {
      timeoutMs: 60000,
      logPrefix: "[trim] Stage 2 - ffmpeg timestamp reset",
      onSuccess: (code) => code === 0 && existsSync(outputPath),
    });

    safeUnlink(tempFile);

    return ffmpegSuccess;
  } catch (error) {
    safeUnlink(tempFile);
    console.log("[trim] Unexpected error:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const tmpFile = join(tmpdir(), `trim_${randomUUID()}.mp4`);

  try {
    const body = await request.json();

    // 파라미터 검증
    const validation = validateTrimRequest(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { originalUrl, startTime, endTime } = validation.data;
    const success = await trimWithStreamlink(originalUrl, startTime, endTime, tmpFile);

    if (!success) {
      return NextResponse.json(
        { error: "streamlink 트리밍에 실패했습니다. streamlink 설치를 확인해주세요." },
        { status: 500 },
      );
    }

    // Stream the output file
    console.log("[trim] Streaming file to client...");

    return streamFile({
      filePath: tmpFile,
      contentType: "video/mp4",
      onStreamEnd: () => safeUnlink(tmpFile),
      onStreamError: (err) => {
        console.error("[trim] Stream error:", err);
        safeUnlink(tmpFile);
      },
    });
  } catch (error: unknown) {
    safeUnlink(tmpFile);
    return handleApiError(error, "trim", "트리밍 처리 중 오류가 발생했습니다");
  }
}
