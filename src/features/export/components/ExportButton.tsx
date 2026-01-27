'use client';

import { useCallback } from 'react';
import { useStore } from '@/stores/useStore';
import { trimVideoMP4Box } from '@/features/export/utils/trimVideoMP4Box';
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

  const handleExport = useCallback(async () => {
    if (!videoFile) {
      setError('Video file not available', 'EXPORT_ERROR');
      return;
    }

    try {
      setPhase('processing');
      setTrimProgress(0);

      const outputBlob = await trimVideoMP4Box({
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
  }, [videoFile, inPoint, outPoint, setPhase, setTrimProgress, setExportResult, setError]);

  if (phase !== 'editing') {
    return null;
  }

  return (
    <button
      onClick={handleExport}
      className="px-[30px] py-[7px] text-[13px] font-medium text-white bg-[#2962ff] border-none rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#0041f5] disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!videoFile}
    >
      Export
    </button>
  );
}
