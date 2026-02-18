import { useCallback, useState, useRef, useEffect } from 'react';
import { TIMELINE } from '@/constants/appConfig';
import { useStore } from '@/stores/useStore';
import type { UrlPreviewState } from '@/types/store';
import type { SSEEvent, DownloadRequest, DownloadJobResponse } from '@/types/sse';
import { calculateOverallProgress, getPhaseMessage } from '../utils/sseProgressUtils';

/**
 * SSE (Server-Sent Events) 기반 URL 다운로드 훅
 *
 * 1. POST /api/download/start → jobId
 * 2. GET /api/download/stream/[jobId] → SSE 스트림
 * 3. GET /api/download/[jobId] → 완료 파일 다운로드
 *
 * HMR 복구:
 * - 장치 1: 마운트 시 store의 activeDownloadJobId가 있으면 자동 재연결
 * - 장치 2: 버튼 클릭 시 activeDownloadJobId가 있으면 재연결 (신규 시작 생략)
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
  const setActiveDownloadJobId = useStore((state) => state.setActiveDownloadJobId);

  // Zustand actions와 React setState는 모두 stable reference이므로
  // 내부 함수에 useCallback 불필요

  function handleError(message: string, eventSource?: EventSource) {
    setErrorAndTransition(message, 'DOWNLOAD_ERROR');
    setIsDownloading(false);
    setDownloadStage(null);
    setActiveDownloadJobId(null);
    if (eventSource) {
      eventSource.close();
      eventSourceRef.current = null;
    }
  }

  async function fetchAndLoadFile(jobId: string) {
    const { urlPreview } = useStore.getState();
    const filename = urlPreview ? `${urlPreview.title || 'video'}.mp4` : 'video.mp4';
    const originalUrl = urlPreview?.originalUrl ?? '';

    const response = await fetch(`/api/download/${jobId}`);
    if (!response.ok) throw new Error('파일 다운로드에 실패했습니다');
    const blob = await response.blob();

    console.log('[SSE Client] File downloaded:', blob.size, 'bytes');

    setVideoFile({
      file: null,
      source: 'url',
      originalUrl,
      name: filename,
      size: blob.size,
      type: 'video/mp4',
      url: URL.createObjectURL(blob),
      duration: 0,
    });
    setPhase('editing');
    setDownloadStage(null);
  }

  function connectToJobStream(jobId: string) {
    setIsDownloading(true);

    const eventSource = new EventSource(`/api/download/stream/${jobId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);

        if (data.type === 'progress') {
          setTrimProgress(calculateOverallProgress(data.phase, data.progress));
          setDownloadStage(data.phase, getPhaseMessage(data.phase, data.processedSeconds, data.totalSeconds));
        } else if (data.type === 'complete') {
          console.log('[SSE Client] Download completed:', jobId);
          eventSource.close();
          eventSourceRef.current = null;
          setActiveDownloadJobId(null);

          // urlPreview는 store에서 읽음 (HMR로 closure 소멸되어도 안전)
          fetchAndLoadFile(jobId)
            .catch((error) => handleError(error instanceof Error ? error.message : '파일 다운로드에 실패했습니다'))
            .finally(() => setIsDownloading(false));
        } else if (data.type === 'error') {
          console.error('[SSE Client] Download error:', data.message);
          handleError(data.message, eventSource);
        }
      } catch (err) {
        console.error('[SSE Client] Failed to parse event:', err);
      }
    };

    eventSource.onerror = () => {
      if (!eventSourceRef.current) return; // 정상 종료 후 발생한 onerror 무시
      console.error('[SSE Client] EventSource connection error');
      handleError('서버 연결이 끊어졌습니다', eventSource);
    };
  }

  // [장치 1] 마운트 시 자동 재연결 + 언마운트 cleanup
  useEffect(() => {
    const activeJobId = useStore.getState().processing.activeDownloadJobId;
    if (activeJobId && !eventSourceRef.current) {
      console.log('[SSE Client] Auto-reconnecting to job:', activeJobId);
      connectToJobStream(activeJobId);
    }

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = useCallback(
    async (urlPreview: UrlPreviewState) => {
      // [장치 2] 활성 job이 있으면 재연결 (신규 다운로드 시작 생략)
      const activeJobId = useStore.getState().processing.activeDownloadJobId;
      if (activeJobId) {
        if (!eventSourceRef.current) {
          console.log('[SSE Client] Reconnecting to existing job:', activeJobId);
          connectToJobStream(activeJobId);
        }
        return;
      }

      // 신규 다운로드
      setIsDownloading(true);
      setTrimProgress(0);
      setDownloadStage(null);

      try {
        abortControllerRef.current = new AbortController();

        const startResponse = await fetch('/api/download/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: urlPreview.originalUrl,
            startTime: urlPreview.inPoint ?? 0,
            endTime: urlPreview.outPoint ?? Math.min(urlPreview.duration, TIMELINE.MAX_SEGMENT_DURATION_SECONDS),
            filename: `${urlPreview.title || 'video'}.mp4`,
            tbr: urlPreview.tbr,
          } satisfies DownloadRequest),
          signal: abortControllerRef.current.signal,
        });

        if (!startResponse.ok) {
          const error = await startResponse.json();
          throw new Error(error.error || '다운로드 시작에 실패했습니다');
        }

        const { jobId }: DownloadJobResponse = await startResponse.json();
        console.log('[SSE Client] Job started:', jobId);

        setActiveDownloadJobId(jobId); // HMR 재연결을 위해 store에 저장
        connectToJobStream(jobId);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[SSE Client] Download cancelled');
          return;
        }
        console.error('[SSE Client] Failed to start download:', error);
        handleError(error instanceof Error ? error.message : '다운로드 시작에 실패했습니다');
      }
    },
    // Zustand actions와 React setState는 stable이므로 handleError/connectToJobStream 의존성 불필요
    [setTrimProgress, setDownloadStage, setActiveDownloadJobId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return { handleDownload, isDownloading };
}
