'use client';

import { useCallback, useState } from 'react';
import { useStore } from '@/stores/useStore';
import {
  useVideoFile,
  useTrimPoints,
  usePhase,
  useCommonActions,
  useProgressActions,
} from '@/stores/selectors';
import { trimVideo } from '@/features/export/utils/trimVideoDispatcher';
import { generateEditedFilename } from '@/features/export/utils/generateFilename';
import { requiresFFmpegDownload } from '@/features/export/utils/formatDetector';

export function ExportButton() {
  const videoFile = useVideoFile();
  const { inPoint, outPoint } = useTrimPoints();
  const phase = usePhase();

  const { setPhase, setErrorAndTransition, setExportResultAndComplete } = useCommonActions();
  const { setTrimProgress } = useProgressActions();

  // State for FFmpeg loading (only happens for non-MP4 formats)
  const [isLoadingFFmpeg, setIsLoadingFFmpeg] = useState(false);
  const [ffmpegLoadProgress, setFFmpegLoadProgress] = useState(0);

  const handleExport = useCallback(async () => {
    if (!videoFile) {
      setErrorAndTransition('Video file not available', 'EXPORT_ERROR');
      return;
    }

    try {
      setPhase('processing');
      setTrimProgress(0);
      setFFmpegLoadProgress(0);

      // URL source: 이미 서버에서 트리밍된 파일이므로 재편집 불가
      // 현재 videoFile.url을 그대로 사용
      if (videoFile.source === 'url') {
        console.log('[ExportButton] URL source - using existing trimmed file');
        const outputUrl = videoFile.url;
        const outputFilename = generateEditedFilename(videoFile.name);

        console.log('[ExportButton] URL:', outputUrl);
        console.log('[ExportButton] Filename:', outputFilename);

        setExportResultAndComplete(outputUrl, outputFilename);
        return;
      }

      // File source: 클라이언트 트리밍 (MP4Box 또는 FFmpeg)
      const outputBlob = await trimVideo({
        inputFile: videoFile.file,
        source: videoFile.source,
        originalUrl: videoFile.originalUrl,
        filename: videoFile.name,
        startTime: inPoint,
        endTime: outPoint,
        onProgress: (progress) => {
          setTrimProgress(progress);
        },
        onFFmpegLoadStart: () => {
          setIsLoadingFFmpeg(true);
          setFFmpegLoadProgress(0);
        },
        onFFmpegLoadProgress: (progress) => {
          setFFmpegLoadProgress(progress);
        },
        onFFmpegLoadComplete: () => {
          setIsLoadingFFmpeg(false);
          setFFmpegLoadProgress(100);
        },
      });

      // Blob URL 생성
      const outputUrl = URL.createObjectURL(outputBlob);
      const outputFilename = generateEditedFilename(videoFile.name);

      console.log('[ExportButton] Created Blob URL:', outputUrl);
      console.log('[ExportButton] Blob size:', outputBlob.size, 'bytes');
      console.log('[ExportButton] Filename:', outputFilename);

      setExportResultAndComplete(outputUrl, outputFilename);
    } catch (error) {
      // Check if error has AppError attached (from parseFFmpegError)
      const appError =
        error instanceof Error && (error as any).appError
          ? (error as any).appError
          : null;

      if (appError) {
        // Use parsed error code and user-friendly message
        setErrorAndTransition(appError.userMessage, appError.code);
      } else {
        // Fallback to basic error
        const errorMessage =
          error instanceof Error ? error.message : 'Export failed';
        setErrorAndTransition(errorMessage, 'EXPORT_ERROR');
      }
    }
  }, [videoFile, inPoint, outPoint, setPhase, setTrimProgress, setExportResultAndComplete, setErrorAndTransition]);

  if (phase !== 'editing') {
    return null;
  }

  // Check if this video will require FFmpeg download (only for file sources)
  const willDownloadFFmpeg = videoFile?.source === 'file' && videoFile.file && requiresFFmpegDownload(videoFile.file);

  // Button text based on loading state
  const getButtonText = () => {
    if (isLoadingFFmpeg) {
      return `Loading FFmpeg... ${ffmpegLoadProgress}%`;
    }
    return 'Export';
  };

  // Button title (tooltip) based on state
  const getButtonTitle = () => {
    if (isLoadingFFmpeg) {
      return `Downloading FFmpeg (20MB)... ${ffmpegLoadProgress}%`;
    }
    if (willDownloadFFmpeg) {
      return 'This format requires downloading FFmpeg (20MB, one-time)';
    }
    return undefined;
  };

  return (
    <button
      onClick={handleExport}
      className="px-[30px] py-[7px] text-[13px] font-medium text-white bg-[#2962ff] border-none rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#0041f5] disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={!videoFile || isLoadingFFmpeg}
      title={getButtonTitle()}
      data-testid="export-button"
    >
      {getButtonText()}
    </button>
  );
}
