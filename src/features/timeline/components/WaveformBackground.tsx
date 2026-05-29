'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useStore } from '@/stores/useStore';
import { UI } from '@/constants/appConfig';
import { getWaveform } from '@/features/url-input/utils/waveformCache';

export function WaveformBackground() {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [hasAudio, setHasAudio] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const videoFile = useStore((state) => state.videoFile);
  const zoom = useStore((state) => state.timeline.zoom);
  const waveformProgress = useStore((state) => state.processing.waveformProgress);
  const setWaveformProgress = useStore((state) => state.setWaveformProgress);

  useEffect(() => {
    if (!videoFile) return;

    let cancelled = false;

    const createInstance = (extra?: { peaks?: number[][]; duration?: number }) => {
      if (!waveformRef.current) return null;

      // Cleanup previous instance
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }

      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#2962ff',
        progressColor: 'transparent',
        cursorColor: 'transparent',
        barWidth: 2,
        barGap: 1,
        height: 180,
        normalize: true,
        interact: false,
        hideScrollbar: true,
        ...(extra?.peaks ? { peaks: extra.peaks, duration: extra.duration } : {}),
      });
      wavesurferRef.current = wavesurfer;
      return wavesurfer;
    };

    const initializeWaveSurfer = async () => {
      if (!waveformRef.current) return;

      setIsLoading(true);
      setWaveformProgress(0);

      try {
        // URL 소스: 영상 전체를 받지 않고 서버에서 오디오-only peaks만 가져온다.
        if (videoFile.source === 'url') {
          const target = videoFile.originalUrl;
          if (!target) {
            setHasAudio(false);
            setIsLoading(false);
            return;
          }

          // URL 입력 시 prefetch된 캐시 Promise 소비 (재요청 없음, 진입~표시 공백 제거)
          let peaks: number[][];
          let duration: number;
          try {
            ({ peaks, duration } = await getWaveform(target));
          } catch {
            if (cancelled) return;
            setHasAudio(false);
            setIsLoading(false);
            setWaveformProgress(100);
            return;
          }
          if (cancelled) return;

          const hasPeaks = Array.isArray(peaks) && peaks[0]?.length > 0;

          // 사전 계산된 peaks로 렌더 (미디어 fetch 없음): create options로 주입
          const wavesurfer = createInstance({ peaks, duration });
          if (!wavesurfer) return;

          wavesurfer.on('error', (error) => {
            console.warn('Waveform render error:', error);
            setHasAudio(false);
            setIsLoading(false);
            setWaveformProgress(100);
          });

          setHasAudio(hasPeaks);
          setIsLoading(false);
          setWaveformProgress(100);
          return;
        }

        // 파일 소스: 기존 방식 — 로컬 blob에서 직접 디코드
        const wavesurfer = createInstance();
        if (!wavesurfer) return;

        wavesurfer.on('loading', (percent) => setWaveformProgress(percent));
        wavesurfer.on('ready', () => {
          setIsLoading(false);
          setWaveformProgress(100);
          setHasAudio(true);
        });
        wavesurfer.on('error', (error) => {
          console.warn('Waveform error (possibly no audio):', error);
          setHasAudio(false);
          setIsLoading(false);
          setWaveformProgress(100);
        });

        wavesurfer.load(videoFile.url);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to create WaveSurfer:', error);
        setHasAudio(false);
        setIsLoading(false);
      }
    };

    // Use setTimeout to ensure DOM is ready
    const timer = setTimeout(initializeWaveSurfer, UI.WAVEFORM_INIT_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [videoFile, setWaveformProgress]);

  // Handle zoom changes with 100ms debounce for smoother experience
  useEffect(() => {
    if (!wavesurferRef.current || isLoading) return;

    // Debounce zoom updates to reduce CPU usage during rapid Ctrl+wheel scrolling
    const debounceTimer = setTimeout(() => {
      if (wavesurferRef.current) {
        wavesurferRef.current.zoom(zoom * 10);
      }
    }, UI.WAVEFORM_ZOOM_DEBOUNCE_MS);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [zoom, isLoading]);

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none relative">
      {/* Waveform container - always rendered so ref can attach */}
      <div ref={waveformRef} className="w-full h-full absolute inset-0" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1c1d20] z-10">
          <div className="text-xs text-[#74808c]">
            Loading waveform... {Math.round(waveformProgress)}%
          </div>
        </div>
      )}

      {/* No audio overlay */}
      {!isLoading && !hasAudio && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1c1d20] z-10">
          <div className="text-xs text-[#74808c]">No audio track</div>
        </div>
      )}
    </div>
  );
}
