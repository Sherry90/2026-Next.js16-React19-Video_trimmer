'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useFileUpload } from '@/features/upload/hooks/useFileUpload';
import { UploadCloudIcon } from '@/shared/ui/icons';

// URL 입력 등 부가 소스 UI는 상위(랜딩)에서 children으로 합성한다
// (upload feature가 url-input feature를 직접 참조하지 않도록 결합 제거).
export function UploadZone({ children }: { children?: ReactNode }) {
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
      className={`flex flex-col items-center justify-center w-full max-w-[600px] min-h-[400px] p-12 border-2 border-dashed rounded-lg transition-all duration-200 cursor-pointer ${
        isDragging
          ? 'border-[#2962ff] bg-[#2962ff]/5'
          : 'border-white/20 bg-transparent'
      }`}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <UploadCloudIcon className="w-16 h-16 mb-6 opacity-50" stroke="#74808c" />

      <h3 className="mb-3 text-[18px] font-medium text-[#d9dce3]">
        Drop video file here
      </h3>

      <p className="mb-6 text-[13px] text-[#74808c] font-light">
        or click to browse
      </p>

      <input
        type="file"
        accept="video/*"
        onChange={handleFileInputChange}
        className="hidden"
        id="file-upload"
      />

      <button
        className="px-[30px] py-[7px] text-[13px] font-medium text-white bg-[#2962ff] border-none rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#0041f5]"
        onClick={(e) => {
          e.stopPropagation();
          document.getElementById('file-upload')?.click();
        }}
      >
        Choose File
      </button>

      <p className="mt-6 text-[11px] text-[#74808c] opacity-70">
        Supported formats: MP4, WebM, OGG, MOV, AVI, MKV (Max 1GB)
      </p>

      {children}
    </div>
  );
}
