'use client';

import { useEffect, useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { useStore } from '@/stores/useStore';

export function useFFmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const isLoadingRef = useRef(false);

  const phase = useStore((state) => state.phase);
  const setFFmpegReady = useStore((state) => state.setFFmpegReady);
  const setFFmpegLoadProgress = useStore((state) => state.setFFmpegLoadProgress);
  const setPhase = useStore((state) => state.setPhase);
  const setError = useStore((state) => state.setError);

  const loadFFmpeg = useCallback(async () => {
    if (ffmpegRef.current?.loaded || isLoadingRef.current) {
      return ffmpegRef.current;
    }

    isLoadingRef.current = true;
    setFFmpegLoadProgress(0);

    try {
      const ffmpeg = new FFmpeg();

      // Progress 로깅
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      // 로딩 진행률 추적 (간단한 시뮬레이션)
      setFFmpegLoadProgress(30);

      const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });

      setFFmpegLoadProgress(100);
      setFFmpegReady(true);
      ffmpegRef.current = ffmpeg;
      isLoadingRef.current = false;

      return ffmpeg;
    } catch (error) {
      isLoadingRef.current = false;
      const errorMessage = error instanceof Error ? error.message : 'FFmpeg loading failed';
      setError(errorMessage, 'FFMPEG_LOAD_ERROR');
      throw error;
    }
  }, [setFFmpegLoadProgress, setFFmpegReady, setError]);

  // Phase가 loading-ffmpeg일 때 자동으로 FFmpeg 로드
  useEffect(() => {
    if (phase === 'loading-ffmpeg') {
      loadFFmpeg()
        .then(() => {
          setPhase('ready');
        })
        .catch((error) => {
          console.error('Failed to load FFmpeg:', error);
        });
    }
  }, [phase, loadFFmpeg, setPhase]);

  return {
    ffmpeg: ffmpegRef.current,
    loadFFmpeg,
  };
}
