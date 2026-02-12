import { useCallback, useState } from 'react';
import { useStore } from '@/stores/useStore';
import { useCommonActions, useProgressActions } from '@/stores/selectors';
import { trimVideo } from '@/features/export/utils/trimVideoDispatcher';
import { generateEditedFilename } from '@/features/export/utils/generateFilename';
import { requiresFFmpegDownload } from '@/features/export/utils/formatDetector';
import type { VideoFile } from '@/types/store';

/**
 * Export 버튼 상태 관리 훅
 *
 * Export 로직, FFmpeg 로딩 상태, 버튼 텍스트/타이틀 관리
 */
export function useExportState(
  videoFile: VideoFile | null,
  inPoint: number,
  outPoint: number
) {
  const { setPhase, setErrorAndTransition, setExportResultAndComplete } =
    useCommonActions();
  const { setTrimProgress } = useProgressActions();

  // FFmpeg loading state (only for non-MP4 formats)
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

      // URL source: already trimmed on server, use existing file
      if (videoFile.source === 'url') {
        console.log(
          '[ExportButton] URL source - using existing trimmed file'
        );
        const outputUrl = videoFile.url;
        const outputFilename = generateEditedFilename(videoFile.name);

        console.log('[ExportButton] URL:', outputUrl);
        console.log('[ExportButton] Filename:', outputFilename);

        setExportResultAndComplete(outputUrl, outputFilename);
        return;
      }

      // File source: client-side trimming (MP4Box or FFmpeg)
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

      // Create Blob URL
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
  }, [
    videoFile,
    inPoint,
    outPoint,
    setPhase,
    setTrimProgress,
    setExportResultAndComplete,
    setErrorAndTransition,
  ]);

  // Check if this video will require FFmpeg download
  const willDownloadFFmpeg =
    videoFile?.source === 'file' &&
    videoFile.file &&
    requiresFFmpegDownload(videoFile.file);

  // Button text based on loading state
  const buttonText = isLoadingFFmpeg
    ? `Loading FFmpeg... ${ffmpegLoadProgress}%`
    : 'Export';

  // Button title (tooltip) based on state
  const buttonTitle = isLoadingFFmpeg
    ? `Downloading FFmpeg (20MB)... ${ffmpegLoadProgress}%`
    : willDownloadFFmpeg
    ? 'This format requires downloading FFmpeg (20MB, one-time)'
    : undefined;

  const isDisabled = !videoFile || isLoadingFFmpeg;

  return {
    buttonText,
    buttonTitle,
    isDisabled,
    handleExport,
  };
}
