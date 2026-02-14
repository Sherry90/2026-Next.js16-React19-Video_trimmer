'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useStore } from '@/stores/useStore';
import { UI } from '@/constants/appConfig';

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

    // Wait for DOM to be ready
    const initializeWaveSurfer = () => {
      if (!waveformRef.current) {
        return;
      }

      // Cleanup previous instance
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }

      setIsLoading(true);
      setWaveformProgress(0);

      try {
        // Create WaveSurfer instance
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
        });

        wavesurferRef.current = wavesurfer;

        // Progress tracking
        wavesurfer.on('loading', (percent) => {
          setWaveformProgress(percent);
        });

        // Ready event
        wavesurfer.on('ready', () => {
          setIsLoading(false);
          setWaveformProgress(100);
          setHasAudio(true);
        });

        // Error handling (no audio track)
        wavesurfer.on('error', (error) => {
          console.warn('Waveform error (possibly no audio):', error);
          setHasAudio(false);
          setIsLoading(false);
          setWaveformProgress(100);
        });

        // Load audio from video file
        wavesurfer.load(videoFile.url);
      } catch (error) {
        console.error('Failed to create WaveSurfer:', error);
        setHasAudio(false);
        setIsLoading(false);
      }
    };

    // Use setTimeout to ensure DOM is ready
    const timer = setTimeout(initializeWaveSurfer, UI.WAVEFORM_INIT_DELAY_MS);

    return () => {
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
