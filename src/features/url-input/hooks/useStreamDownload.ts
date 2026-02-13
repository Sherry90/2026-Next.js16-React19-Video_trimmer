import { useCallback, useState, useRef } from 'react';
import { useStore } from '@/stores/useStore';
import type { UrlPreviewState } from '@/types/store';
import type {
  SSEEvent,
  SSEProgressEvent,
  SSEErrorEvent,
  DownloadRequest,
  DownloadJobResponse,
} from '@/types/sse';
import { calculateOverallProgress, getPhaseMessage } from '../utils/sseProgressUtils';

/**
 * SSE (Server-Sent Events) 기반 URL 다운로드 훅
 *
 * 실시간 progress 업데이트를 제공하며, 다음과 같은 흐름으로 동작합니다:
 * 1. POST /api/download/start - JobID 받기
 * 2. GET /api/download/stream/[jobId] - SSE 스트림 연결
 * 3. GET /api/download/[jobId] - 완료된 파일 다운로드
 */
export function useStreamDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const setTrimProgress = useStore((state) => state.setTrimProgress);
  const setDownloadStage = useStore((state) => state.setDownloadStage);
  const setPhase = useStore((state) => state.setPhase);
  const setVideoFile = useStore((state) => state.setVideoFile);
  const setErrorAndTransition = useStore((state) => state.setErrorAndTransition);

  const handleDownload = useCallback(
    async (urlPreview: UrlPreviewState) => {
      setIsDownloading(true);
      setTrimProgress(0);
      setDownloadStage(null);

      const filename = `${urlPreview.title || 'video'}.mp4`;

      console.log('[SSE Client] Starting download...');
      console.log('[SSE Client] URL:', urlPreview.originalUrl);
      console.log('[SSE Client] Range:', urlPreview.inPoint, '-', urlPreview.outPoint);

      /**
       * Progress 이벤트 핸들러
       */
      const handleProgressEvent = (data: SSEProgressEvent) => {
        const overallProgress = calculateOverallProgress(data.phase, data.progress);
        const message = getPhaseMessage(data.phase, data.processedSeconds, data.totalSeconds);

        console.log(
          `[SSE Client] Phase: ${data.phase}, Raw: ${data.progress}%, Overall: ${overallProgress}% (${Math.round(
            data.processedSeconds ?? 0
          )}/${Math.round(data.totalSeconds ?? 0)}s)`
        );

        setTrimProgress(overallProgress);
        setDownloadStage(data.phase, message);
      };

      /**
       * Complete 이벤트 핸들러
       */
      const handleCompleteEvent = (jobId: string, eventSource: EventSource) => {
        console.log('[SSE Client] Download completed:', jobId);

        // SSE 스트림 즉시 종료 (서버가 닫기 전에 클라이언트가 먼저 종료)
        eventSource.close();
        eventSourceRef.current = null;

        // 완료된 파일 다운로드 (일반 HTTP 요청)
        fetch(`/api/download/${jobId}`)
          .then((response) => {
            if (!response.ok) {
              throw new Error('파일 다운로드에 실패했습니다');
            }
            return response.blob();
          })
          .then((blob) => {
            console.log('[SSE Client] File downloaded:', blob.size, 'bytes');

            // VideoFile 설정
            const objectUrl = URL.createObjectURL(blob);

            setVideoFile({
              file: null,
              source: 'url',
              originalUrl: urlPreview.originalUrl,
              name: filename,
              size: blob.size,
              type: 'video/mp4',
              url: objectUrl,
              duration: 0, // video.js will set the real duration
            });

            setPhase('editing');
            setDownloadStage(null);
          })
          .catch((error) => {
            const errorMessage = error instanceof Error ? error.message : '파일 다운로드에 실패했습니다';
            setErrorAndTransition(errorMessage, 'DOWNLOAD_ERROR');
          })
          .finally(() => {
            setIsDownloading(false);
            // eventSource는 이미 닫힘
          });
      };

      /**
       * Error 이벤트 핸들러
       */
      const handleErrorEvent = (data: SSEErrorEvent, eventSource: EventSource) => {
        console.error('[SSE Client] Download error:', data.message);
        setErrorAndTransition(data.message, 'DOWNLOAD_ERROR');
        setIsDownloading(false);
        setDownloadStage(null);
        eventSource.close();
        eventSourceRef.current = null;
      };

      /**
       * EventSource onerror 핸들러
       */
      const handleConnectionError = (eventSource: EventSource) => {
        // EventSource가 이미 닫혔으면 무시 (정상 종료 후 발생한 onerror)
        if (!eventSourceRef.current) {
          console.log('[SSE Client] Stream closed (already handled)');
          return;
        }

        console.error('[SSE Client] EventSource connection error');
        setErrorAndTransition('서버 연결이 끊어졌습니다', 'NETWORK_ERROR');
        setIsDownloading(false);
        setDownloadStage(null);
        eventSource.close();
        eventSourceRef.current = null;
      };

      try {
        // 1. POST /api/download/start - JobID 받기
        abortControllerRef.current = new AbortController();

        const downloadRequest: DownloadRequest = {
          url: urlPreview.originalUrl,
          startTime: urlPreview.inPoint,
          endTime: urlPreview.outPoint,
          filename,
          tbr: urlPreview.tbr,
        };

        const startResponse = await fetch('/api/download/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(downloadRequest),
          signal: abortControllerRef.current.signal,
        });

        if (!startResponse.ok) {
          const error = await startResponse.json();
          throw new Error(error.error || '다운로드 시작에 실패했습니다');
        }

        const { jobId }: DownloadJobResponse = await startResponse.json();
        console.log('[SSE Client] Job started:', jobId);

        // 2. SSE 스트림 연결
        const eventSource = new EventSource(`/api/download/stream/${jobId}`);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          try {
            const data: SSEEvent = JSON.parse(event.data);

            if (data.type === 'progress') {
              handleProgressEvent(data);
            } else if (data.type === 'complete') {
              handleCompleteEvent(jobId, eventSource);
            } else if (data.type === 'error') {
              handleErrorEvent(data, eventSource);
            }
          } catch (err) {
            console.error('[SSE Client] Failed to parse event:', err);
          }
        };

        eventSource.onerror = () => {
          handleConnectionError(eventSource);
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[SSE Client] Download cancelled');
          return;
        }

        console.error('[SSE Client] Failed to start download:', error);
        const errorMessage = error instanceof Error ? error.message : '다운로드 시작에 실패했습니다';
        setErrorAndTransition(errorMessage, 'DOWNLOAD_ERROR');
        setIsDownloading(false);
        setDownloadStage(null);
      }
    },
    [setTrimProgress, setDownloadStage, setVideoFile, setPhase, setErrorAndTransition]
  );

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return {
    handleDownload,
    isDownloading,
    cleanup,
  };
}
