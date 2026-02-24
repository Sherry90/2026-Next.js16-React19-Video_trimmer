'use client';

import { useCallback, useEffect, useState } from 'react';
import { useStore } from '@/stores/useStore';

export function DownloadButton() {
  const phase = useStore((state) => state.phase);
  const outputUrl = useStore((state) => state.export.outputUrl);
  const outputFilename = useStore((state) => state.export.outputFilename);
  const setPhase = useStore((state) => state.setPhase);
  const reset = useStore((state) => state.reset);

  const lastDot = outputFilename ? outputFilename.lastIndexOf('.') : -1;
  const baseName = outputFilename
    ? lastDot !== -1 ? outputFilename.slice(0, lastDot) : outputFilename
    : '';
  const ext = outputFilename && lastDot !== -1 ? outputFilename.slice(lastDot) : '';

  const [editableName, setEditableName] = useState('');

  useEffect(() => {
    if (outputFilename) {
      const dot = outputFilename.lastIndexOf('.');
      setEditableName(dot !== -1 ? outputFilename.slice(0, dot) : outputFilename);
    }
  }, [outputFilename]);

  const handleDownload = useCallback(() => {
    if (!outputUrl || !outputFilename) return;

    const finalName = editableName.trim() || baseName;
    const link = document.createElement('a');
    link.href = outputUrl;
    link.download = finalName + ext;
    link.click();
  }, [outputUrl, outputFilename, editableName, baseName, ext]);

  const handleBackToEdit = useCallback(() => {
    setPhase('editing');
  }, [setPhase]);

  const handleEditAnother = useCallback(() => {
    reset();
  }, [reset]);

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

      <div className="text-left space-y-1">
        <label htmlFor="save-as-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Save as
        </label>
        <div className="flex items-center gap-1">
          <input
            id="save-as-input"
            type="text"
            value={editableName}
            onChange={(e) => setEditableName(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {ext && (
            <span className="text-sm text-gray-500 dark:text-gray-400 select-none whitespace-nowrap">
              {ext}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={handleDownload}
          data-testid="download-button"
          className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Download Video
        </button>

        <button
          onClick={handleBackToEdit}
          data-testid="back-to-edit-button"
          className="px-6 py-3 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          Back to Edit
        </button>

        <button
          onClick={handleEditAnother}
          data-testid="edit-another-button"
          className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          Edit Another File
        </button>
      </div>
    </div>
  );
}
