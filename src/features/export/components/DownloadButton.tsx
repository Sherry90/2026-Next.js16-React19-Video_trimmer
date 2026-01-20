'use client';

import { useCallback } from 'react';
import { useStore } from '@/stores/useStore';

export function DownloadButton() {
  const phase = useStore((state) => state.phase);
  const outputUrl = useStore((state) => state.export.outputUrl);
  const outputFilename = useStore((state) => state.export.outputFilename);

  const handleDownload = useCallback(() => {
    if (!outputUrl || !outputFilename) return;

    const link = document.createElement('a');
    link.href = outputUrl;
    link.download = outputFilename;
    link.click();
  }, [outputUrl, outputFilename]);

  if (phase !== 'completed' || !outputUrl || !outputFilename) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg text-center space-y-4">
      <svg
        className="w-16 h-16 mx-auto text-green-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Video Ready!
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        Your trimmed video is ready to download
      </p>

      <button
        onClick={handleDownload}
        className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Download Video
      </button>
    </div>
  );
}
