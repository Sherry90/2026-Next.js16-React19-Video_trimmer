'use client';

import { useCallback } from 'react';
import { useStore } from '@/stores/useStore';
import { useFFmpeg } from '@/hooks/useFFmpeg';
import { trimVideo } from '@/features/export/utils/trimVideo';
import { generateEditedFilename } from '@/features/export/utils/generateFilename';

export function ExportButton() {
  const { ffmpeg } = useFFmpeg();

  const videoFile = useStore((state) => state.videoFile);
  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);
  const phase = useStore((state) => state.phase);

  const setPhase = useStore((state) => state.setPhase);
  const setTrimProgress = useStore((state) => state.setTrimProgress);
  const setExportResult = useStore((state) => state.setExportResult);
  const setError = useStore((state) => state.setError);

  const handleExport = useCallback(async () => {
    if (!ffmpeg || !videoFile) {
      setError('FFmpeg or video file not available', 'EXPORT_ERROR');
      return;
    }

    try {
      setPhase('processing');
      setTrimProgress(0);

      const outputBlob = await trimVideo(ffmpeg, {
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
  }, [ffmpeg, videoFile, inPoint, outPoint, setPhase, setTrimProgress, setExportResult, setError]);

  if (phase !== 'editing' && phase !== 'ready') {
    return null;
  }

  return (
    <button
      onClick={handleExport}
      className="px-6 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!ffmpeg || !videoFile}
    >
      Export Video
    </button>
  );
}
