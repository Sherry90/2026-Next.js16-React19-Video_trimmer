import { useState, useCallback } from 'react';
import { useStore } from '@/stores/useStore';
import { useProgressActions } from '@/stores/selectors';
import { trimVideoServer } from '@/features/export/utils/trimVideoServer';
import type { UrlPreviewState } from '@/types/store';

/**
 * URL 다운로드 훅
 *
 * 서버 트리밍 후 editing phase로 전환
 */
export function useUrlDownload() {
  const { setTrimProgress } = useProgressActions();
  const setPhase = useStore((state) => state.setPhase);
  const setVideoFile = useStore((state) => state.setVideoFile);
  const setErrorAndTransition = useStore((state) => state.setErrorAndTransition);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = useCallback(
    async (urlPreview: UrlPreviewState) => {
      setIsDownloading(true);
      setTrimProgress(0);

      try {
        const blob = await trimVideoServer({
          originalUrl: urlPreview.originalUrl,
          startTime: urlPreview.inPoint,
          endTime: urlPreview.outPoint,
          filename: `${urlPreview.title || 'video'}.mp4`,
        });

        // Blob -> Object URL -> editing phase
        // URL source는 유지하여 Export 시 서버 트리밍 사용
        const filename = `${urlPreview.title || 'video'}.mp4`;
        const objectUrl = URL.createObjectURL(blob);

        setVideoFile({
          file: null, // URL source는 File 객체 불필요
          source: 'url',
          originalUrl: urlPreview.originalUrl,
          name: filename,
          size: blob.size,
          type: 'video/mp4',
          url: objectUrl,
          duration: 0, // video.js will set the real duration
        });

        setPhase('editing');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '다운로드에 실패했습니다';
        setErrorAndTransition(errorMessage, 'DOWNLOAD_ERROR');
      } finally {
        setIsDownloading(false);
      }
    },
    [setTrimProgress, setVideoFile, setPhase, setErrorAndTransition]
  );

  return {
    handleDownload,
    isDownloading,
  };
}
