'use client';

import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useStore } from '@/stores/useStore';

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
    if (!waveformRef.current || !videoFile) return;

    // Cleanup previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
      wavesurferRef.current = null;
    }

    setIsLoading(true);
    setWaveformProgress(0);

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

    // Load audio from video file
    wavesurfer.load(videoFile.url);

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

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [videoFile, setWaveformProgress]);

  // Handle zoom changes
  useEffect(() => {
    if (wavesurferRef.current && !isLoading) {
      wavesurferRef.current.zoom(zoom * 10);
    }
  }, [zoom, isLoading]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div style={{ fontSize: '12px', color: '#74808c' }}>
          Loading waveform... {Math.round(waveformProgress)}%
        </div>
      </div>
    );
  }

  // Show empty background if no audio
  if (!hasAudio) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div style={{ fontSize: '12px', color: '#74808c' }}>No audio track</div>
      </div>
    );
  }

  // Show waveform
  return (
    <div className="w-full h-full overflow-hidden pointer-events-none">
      <div ref={waveformRef} className="w-full h-full" />
    </div>
  );
}
