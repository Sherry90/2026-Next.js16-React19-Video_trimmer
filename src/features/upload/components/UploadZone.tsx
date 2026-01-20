'use client';

import { useCallback, useState } from 'react';
import { useFileUpload } from '@/features/upload/hooks/useFileUpload';

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const { handleFileSelect } = useFileUpload();

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`
        flex flex-col items-center justify-center
        w-full max-w-2xl mx-auto
        min-h-[400px] p-12
        border-2 border-dashed rounded-lg
        transition-colors duration-200
        ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
        }
      `}
    >
      <svg
        className="w-16 h-16 mb-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>

      <h3 className="mb-2 text-xl font-semibold text-gray-700 dark:text-gray-300">
        Drop video file here
      </h3>

      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        or click to browse
      </p>

      <input
        type="file"
        accept="video/*"
        onChange={handleFileInputChange}
        className="hidden"
        id="file-upload"
      />

      <label
        htmlFor="file-upload"
        className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
      >
        Choose File
      </label>

      <p className="mt-4 text-xs text-gray-400">
        Supported formats: MP4, WebM, OGG, MOV, AVI, MKV (Max 1GB)
      </p>
    </div>
  );
}
