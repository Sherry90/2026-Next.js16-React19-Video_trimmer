"use client";

import { usePhase, useTrimProgress, useVideoFile } from "@/stores/hooks";
import { ProgressBar } from "@/shared/ui/ProgressBar";
import { getTrimmerType, getTrimmerName } from "@/features/export/utils/formatDetector";

export function ExportProgress() {
  const phase = usePhase();
  const trimProgress = useTrimProgress();
  const videoFile = useVideoFile();

  if (phase !== "processing") {
    return null;
  }

  // Determine which trimmer is being used
  const trimmerType =
    videoFile?.source === "url"
      ? "ffmpeg" // URL 소스는 서버 ffmpeg 사용
      : videoFile?.file
        ? getTrimmerType(videoFile.file)
        : "mp4box";
  const trimmerName = videoFile?.source === "url" ? "Server FFmpeg" : getTrimmerName(trimmerType);
  const isFastTrimming = videoFile?.source === "url" || trimmerType === "mp4box";

  return (
    <div
      className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg"
      data-testid="export-progress"
    >
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Processing Video...
      </h3>

      <ProgressBar progress={trimProgress} label={`Using ${trimmerName}`} />

      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
        {isFastTrimming ? "Fast stream-copy trimming (no re-encoding)" : "Processing your video..."}
      </p>
    </div>
  );
}
