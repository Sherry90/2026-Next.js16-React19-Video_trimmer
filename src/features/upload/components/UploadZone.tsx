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
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: '600px',
        minHeight: '400px',
        padding: '48px',
        border: isDragging ? '2px dashed #2962ff' : '2px dashed rgba(255, 255, 255, 0.2)',
        borderRadius: '8px',
        backgroundColor: isDragging ? 'rgba(41, 98, 255, 0.05)' : 'transparent',
        transition: 'all 0.2s',
        cursor: 'pointer',
      }}
      onClick={() => document.getElementById('file-upload')?.click()}
    >
      <svg
        style={{ width: '64px', height: '64px', marginBottom: '24px', opacity: 0.5 }}
        fill="none"
        stroke="#74808c"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>

      <h3 style={{
        marginBottom: '12px',
        fontSize: '18px',
        fontWeight: 500,
        color: '#d9dce3',
      }}>
        Drop video file here
      </h3>

      <p style={{
        marginBottom: '24px',
        fontSize: '13px',
        color: '#74808c',
        fontWeight: 300,
      }}>
        or click to browse
      </p>

      <input
        type="file"
        accept="video/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        id="file-upload"
      />

      <button
        style={{
          padding: '7px 30px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#ffffff',
          backgroundColor: '#2962ff',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0041f5'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2962ff'}
        onClick={(e) => {
          e.stopPropagation();
          document.getElementById('file-upload')?.click();
        }}
      >
        Choose File
      </button>

      <p style={{
        marginTop: '24px',
        fontSize: '11px',
        color: '#74808c',
        opacity: 0.7,
      }}>
        Supported formats: MP4, WebM, OGG, MOV, AVI, MKV (Max 1GB)
      </p>
    </div>
  );
}
