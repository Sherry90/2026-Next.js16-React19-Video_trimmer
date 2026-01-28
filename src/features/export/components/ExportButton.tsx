'use client';

import { useCallback, useEffect } from 'react';
import { useStore } from '@/stores/useStore';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { trimVideoFFmpeg } from '@/features/export/utils/trimVideoFFmpeg';
import { generateEditedFilename } from '@/features/export/utils/generateFilename';

export function ExportButton() {
  const videoFile = useStore((state) => state.videoFile);
  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);
  const phase = useStore((state) => state.phase);

  const setPhase = useStore((state) => state.setPhase);
  const setTrimProgress = useStore((state) => state.setTrimProgress);
  const setExportResult = useStore((state) => state.setExportResult);
  const setError = useStore((state) => state.setError);

  const { ffmpeg, isLoaded, isLoading, load } = useFFmpeg();

  // Load FFmpeg when component mounts
  useEffect(() => {
    if (!isLoaded && !isLoading) {
      load().catch((error) => {
        console.error('Failed to load FFmpeg:', error);
      });
    }
  }, [isLoaded, isLoading, load]);

  const handleExport = useCallback(async () => {
    if (!videoFile) {
      setError('Video file not available', 'EXPORT_ERROR');
      return;
    }

    if (!ffmpeg) {
      setError('FFmpeg not loaded', 'EXPORT_ERROR');
      return;
    }

    try {
      setPhase('processing');
      setTrimProgress(0);

      const outputBlob = await trimVideoFFmpeg({
        ffmpeg,
        inputFile: videoFile.file,
        startTime: inPoint,
        endTime: outPoint,
        onProgress: (progress) => {
          setTrimProgress(progress);
        },
      });

      // Blob URL 생성
      const outputUrl = URL.createObjectURL(outputBlob);
      const outputFilename = generateEditedFilename(videoFile.name);

      setExportResult(outputUrl, outputFilename);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      setError(errorMessage, 'EXPORT_ERROR');
    }
  }, [videoFile, inPoint, outPoint, ffmpeg, setPhase, setTrimProgress, setExportResult, setError]);

  if (phase !== 'editing') {
    return null;
  }

  return (
    <button
      onClick={handleExport}
      className="px-[30px] py-[7px] text-[13px] font-medium text-white bg-[#2962ff] border-none rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#0041f5] disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!videoFile || !isLoaded}
      title={!isLoaded ? 'Loading FFmpeg...' : undefined}
    >
      Export
    </button>
  );
}
