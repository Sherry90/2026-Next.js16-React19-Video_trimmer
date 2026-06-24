import { useCallback } from 'react';
import { useStore } from '@/stores/useStore';
import { useCommonActions, useProgressActions } from '@/stores/selectors';
import { trimVideo } from '@/features/export/utils/trimVideoDispatcher';
import { generateTrimFilename } from '@/features/export/utils/generateFilename';
import { requiresFFmpegDownload } from '@/features/export/utils/formatDetector';
import { startStreamDownload } from '@/features/export/utils/streamDownloadController';
import { useFFmpegLoader } from './useFFmpegLoader';
import { errorFromRaw } from '@/shared/lib/errorHandler';
import type { VideoFile } from '@/types/store';

/**
 * Export 버튼 상태 관리 훅
 *
 * Export 로직, 버튼 텍스트/타이틀 관리
 */
export function useExportState(
  videoFile: VideoFile | null,
  inPoint: number,
  outPoint: number
) {
  const { setPhase, setErrorAndTransition, setExportResultAndComplete } =
    useCommonActions();
  const { setProgress } = useProgressActions();

  // FFmpeg loading state (delegated to separate hook)
  const ffmpegLoader = useFFmpegLoader();

  const handleExport = useCallback(async () => {
    if (!videoFile) {
      setErrorAndTransition('Video file not available', 'EXPORT_ERROR');
      return;
    }

    try {
      setPhase('processing');
      setProgress('trim', 0);

      // URL source: 확정된 구간을 서버에서 실제 다운로드 (SSE).
      // 컨트롤러가 진행률/완료/에러(completed 합류)를 직접 처리한다.
      if (videoFile.source === 'url') {
        await startStreamDownload();
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
          setProgress('trim', progress);
        },
        ...ffmpegLoader.handlers,
      });

      // Create Blob URL
      const outputUrl = URL.createObjectURL(outputBlob);
      const outputFilename = generateTrimFilename(videoFile.name, inPoint, outPoint);

      setExportResultAndComplete(outputUrl, outputFilename);
    } catch (error) {
      // Check if error has AppError attached (from parseFFmpegError)
      const appError =
        error instanceof Error && (error as any).appError
          ? (error as any).appError
          : null;

      if (appError) {
        // Use parsed error code and user-friendly message (+ 기술 상세)
        setErrorAndTransition(
          appError.userMessage,
          appError.code,
          appError.technicalDetails ?? appError.message,
        );
      } else {
        // Fallback: 실제 원인을 분류해 친화 메시지 + 기술 상세로 전달 (원인 삼키지 않음)
        const rawMessage =
          error instanceof Error ? error.message : 'Export failed';
        const parsed = errorFromRaw(rawMessage, 'EXPORT_ERROR');
        setErrorAndTransition(parsed.userMessage, parsed.code, rawMessage);
      }
    }
  }, [
    videoFile,
    inPoint,
    outPoint,
    setPhase,
    setProgress,
    setExportResultAndComplete,
    setErrorAndTransition,
  ]);

  // Check if this video will require FFmpeg download
  const willDownloadFFmpeg =
    videoFile?.source === 'file' &&
    videoFile.file &&
    requiresFFmpegDownload(videoFile.file);

  // Button text based on loading state
  const buttonText = ffmpegLoader.isLoading
    ? `Loading FFmpeg... ${ffmpegLoader.progress}%`
    : 'Export';

  // Button title (tooltip) based on state
  const buttonTitle = ffmpegLoader.isLoading
    ? `Downloading FFmpeg (20MB)... ${ffmpegLoader.progress}%`
    : willDownloadFFmpeg
    ? 'This format requires downloading FFmpeg (20MB, one-time)'
    : undefined;

  const isDisabled = !videoFile || ffmpegLoader.isLoading;

  return {
    buttonText,
    buttonTitle,
    isDisabled,
    handleExport,
  };
}
