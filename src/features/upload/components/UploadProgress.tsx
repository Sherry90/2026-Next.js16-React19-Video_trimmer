'use client';

import { useStore } from '@/stores/useStore';
import { ProgressBar } from '@/components/ProgressBar';
import { formatBytes } from '@/utils/formatBytes';

export function UploadProgress() {
  const videoFile = useStore((state) => state.videoFile);
  const uploadProgress = useStore((state) => state.processing.uploadProgress);
  const phase = useStore((state) => state.phase);

  if (!videoFile || phase !== 'uploading') {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Loading...
      </h3>

      <div className="space-y-4">
        {/* 파일 정보 */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium text-gray-900 dark:text-gray-100">{videoFile.name}</p>
          <p>{formatBytes(videoFile.size)}</p>
        </div>

        {/* 파일 업로드 진행률 */}
        <ProgressBar
          progress={uploadProgress}
          label="File Upload"
        />
      </div>
    </div>
  );
}
