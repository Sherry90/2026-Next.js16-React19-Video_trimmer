import { useEffect, useRef, useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export function useFFmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (ffmpegRef.current) {
        // FFmpeg instance cleanup (if needed)
      }
    };
  }, []);

  const load = async (onProgress?: (progress: number) => void) => {
    if (isLoaded || isLoading) return;

    try {
      setIsLoading(true);
      setLoadError(null);

      const ffmpeg = new FFmpeg();

      // Set up progress logging
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      // Set up progress callback
      ffmpeg.on('progress', ({ progress }) => {
        // progress is 0-1, convert to 0-100
        onProgress?.(Math.round(progress * 100));
      });

      onProgress?.(0);

      // Load FFmpeg core
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      onProgress?.(100);

      ffmpegRef.current = ffmpeg;
      setIsLoaded(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load FFmpeg';
      setLoadError(errorMessage);
      console.error('FFmpeg load error:', error);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    ffmpeg: ffmpegRef.current,
    isLoaded,
    isLoading,
    loadError,
    load,
  };
}
