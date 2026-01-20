'use client';

import { useStore } from '@/stores/useStore';
import { ProgressBar } from '@/components/ProgressBar';

export function ExportProgress() {
  const phase = useStore((state) => state.phase);
  const trimProgress = useStore((state) => state.processing.trimProgress);

  if (phase !== 'processing') {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Processing Video...
      </h3>

      <ProgressBar
        progress={trimProgress}
        label="Trimming"
      />

      <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 text-center">
        Please wait while we process your video
      </p>
    </div>
  );
}
