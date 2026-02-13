import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '@/stores/useStore';
import type { UrlPreviewState } from '@/types/store';

/**
 * Socket.IO 기반 URL 다운로드 훅
 *
 * 실시간 progress 업데이트
 */
export function useSocketDownload() {
  const socketRef = useRef<Socket | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const setTrimProgress = useStore((state) => state.setTrimProgress);
  const setDownloadStage = useStore((state) => state.setDownloadStage);
  const setPhase = useStore((state) => state.setPhase);
  const setVideoFile = useStore((state) => state.setVideoFile);
  const setErrorAndTransition = useStore((state) => state.setErrorAndTransition);

  // Socket.IO 연결 초기화
  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'], // WebSocket 우선, HTTP long-polling 폴백
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('[Socket.IO Client] Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket.IO Client] Disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket.IO Client] Connection error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleDownload = useCallback(
    async (urlPreview: UrlPreviewState) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        setErrorAndTransition('Socket.IO 연결이 끊어졌습니다', 'SOCKET_ERROR');
        return;
      }

      setIsDownloading(true);
      setTrimProgress(0);
      setDownloadStage(null);
      activeJobIdRef.current = null;

      const filename = `${urlPreview.title || 'video'}.mp4`;

      console.log('[Socket.IO Client] Starting download...');
      console.log('[Socket.IO Client] URL:', urlPreview.originalUrl);
      console.log('[Socket.IO Client] Range:', urlPreview.inPoint, '-', urlPreview.outPoint);

      // Progress 이벤트 리스너
      const onProgress = (data: {
        jobId: string;
        progress: number;
        processedSeconds?: number;
        totalSeconds?: number;
        phase: 'downloading' | 'processing' | 'completed';
      }) => {
        if (activeJobIdRef.current && data.jobId !== activeJobIdRef.current) {
          return;
        }
        if (!activeJobIdRef.current) {
          activeJobIdRef.current = data.jobId;
        }

        console.log(
          `[Socket.IO Client] Phase: ${data.phase}, Progress: ${data.progress}% (${Math.round(
            data.processedSeconds ?? 0
          )}/${Math.round(data.totalSeconds ?? 0)}s)`
        );
        setTrimProgress(data.progress);

        // Phase별 메시지
        const phaseMessages = {
          downloading: `다운로드 중 (${Math.round(
            data.processedSeconds ?? 0
          )}/${Math.round(data.totalSeconds ?? 0)}s)`,
          processing: 'FFmpeg로 타임스탬프 리셋 중...',
          completed: '완료!',
        };

        const message = phaseMessages[data.phase] || '처리 중...';
        setDownloadStage(data.phase, message);
      };

      // Complete 이벤트 리스너
      const onComplete = async (data: { jobId: string; filename: string }) => {
        if (activeJobIdRef.current && data.jobId !== activeJobIdRef.current) {
          return;
        }
        if (!activeJobIdRef.current) {
          activeJobIdRef.current = data.jobId;
        }

        console.log('[Socket.IO Client] Download completed:', data.jobId);

        try {
          // 파일 다운로드
          const response = await fetch(`/api/download/${data.jobId}`);
          if (!response.ok) {
            throw new Error('파일 다운로드에 실패했습니다');
          }

          const blob = await response.blob();
          console.log('[Socket.IO Client] File downloaded:', blob.size, 'bytes');

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
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : '파일 다운로드에 실패했습니다';
          setErrorAndTransition(errorMessage, 'DOWNLOAD_ERROR');
        } finally {
          activeJobIdRef.current = null;
          setIsDownloading(false);
          // Cleanup listeners
          socket.off('progress', onProgress);
          socket.off('complete', onComplete);
          socket.off('error', onError);
        }
      };

      // Error 이벤트 리스너
      const onError = (data: { jobId: string; message: string }) => {
        if (activeJobIdRef.current && data.jobId !== activeJobIdRef.current) {
          return;
        }
        if (!activeJobIdRef.current && data.jobId) {
          activeJobIdRef.current = data.jobId;
        }

        console.error('[Socket.IO Client] Download error:', data.message);
        setErrorAndTransition(data.message, 'DOWNLOAD_ERROR');
        setIsDownloading(false);
        setDownloadStage(null);
        activeJobIdRef.current = null;

        // Cleanup listeners
        socket.off('progress', onProgress);
        socket.off('complete', onComplete);
        socket.off('error', onError);
      };

      // 이벤트 리스너 등록
      socket.on('progress', onProgress);
      socket.on('complete', onComplete);
      socket.on('error', onError);

      // Emit start-download 이벤트
      socket.emit('start-download', {
        url: urlPreview.originalUrl,
        startTime: urlPreview.inPoint,
        endTime: urlPreview.outPoint,
        filename,
        tbr: urlPreview.tbr, // Total bitrate (kbps)
      });
    },
    [
      setTrimProgress,
      setDownloadStage,
      setVideoFile,
      setPhase,
      setErrorAndTransition,
    ]
  );

  return {
    handleDownload,
    isDownloading,
  };
}
