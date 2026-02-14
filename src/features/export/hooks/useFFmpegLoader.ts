import { useState, useCallback } from 'react';

/**
 * FFmpeg 로딩 상태 관리 훅
 *
 * FFmpeg.wasm 다운로드 및 로딩 상태를 관리
 * useExportState에서 책임 분리
 */
export function useFFmpegLoader() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handlers = {
    onFFmpegLoadStart: useCallback(() => {
      setIsLoading(true);
      setProgress(0);
    }, []),

    onFFmpegLoadProgress: useCallback((progress: number) => {
      setProgress(progress);
    }, []),

    onFFmpegLoadComplete: useCallback(() => {
      setIsLoading(false);
      setProgress(100);
    }, []),
  };

  return {
    isLoading,
    progress,
    handlers,
  };
}
