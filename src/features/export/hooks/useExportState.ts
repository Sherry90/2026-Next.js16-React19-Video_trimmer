import { useCallback } from "react";
import { usePhaseActions, useErrorActions, useProgressActions } from "@/stores/hooks";
import { startStreamDownload } from "@/features/export/utils/streamDownloadController";
import { errorFromRaw } from "@/shared/lib/errorHandler";
import type { VideoFile } from "@/types/store";
import type { AppError } from "@/types/types";

/**
 * Export 버튼 상태 관리 훅
 *
 * Export 로직, 버튼 텍스트/타이틀 관리
 */
export function useExportState(videoFile: VideoFile | null, _inPoint: number, _outPoint: number) {
  const { setPhase } = usePhaseActions();
  const { setErrorAndTransition } = useErrorActions();
  const { setProgress } = useProgressActions();

  const handleExport = useCallback(async () => {
    if (!videoFile) {
      setErrorAndTransition("Video file not available", "EXPORT_ERROR");
      return;
    }

    try {
      setPhase("processing");
      setProgress("trim", 0);

      // URL과 로컬 파일 모두 동일한 네이티브 FFmpeg job/SSE 경로로 처리한다.
      await startStreamDownload();
    } catch (error) {
      // Check if error has AppError attached (from parseFFmpegError)
      const appError =
        error instanceof Error
          ? ((error as Error & { appError?: AppError }).appError ?? null)
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
        const rawMessage = error instanceof Error ? error.message : "Export failed";
        const parsed = errorFromRaw(rawMessage, "EXPORT_ERROR");
        setErrorAndTransition(parsed.userMessage, parsed.code, rawMessage);
      }
    }
  }, [videoFile, setPhase, setProgress, setErrorAndTransition]);

  const buttonText = "Export";
  const buttonTitle = "번들 네이티브 FFmpeg로 프레임 정확하게 내보냅니다";
  const isDisabled = !videoFile;

  return {
    buttonText,
    buttonTitle,
    isDisabled,
    handleExport,
  };
}
