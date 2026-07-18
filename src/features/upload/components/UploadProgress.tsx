"use client";

import { useVideoFile, useUploadProgress, usePhase } from "@/stores/hooks";
import { ProgressBar } from "@/shared/ui/ProgressBar";
import { Card } from "@/shared/ui/Card";
import { formatBytes } from "@/shared/lib/formatBytes";

export function UploadProgress() {
  const videoFile = useVideoFile();
  const uploadProgress = useUploadProgress();
  const phase = usePhase();

  if (!videoFile || phase !== "uploading") {
    return null;
  }

  return (
    <Card variant="white">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Loading...</h3>

      <div className="space-y-4">
        {/* 파일 정보 */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium text-gray-900 dark:text-gray-100">{videoFile.name}</p>
          <p>{formatBytes(videoFile.size)}</p>
        </div>

        {/* 파일 업로드 진행률 */}
        <ProgressBar progress={uploadProgress} label="File Upload" />
      </div>
    </Card>
  );
}
