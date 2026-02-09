'use client';

import { useRef, useEffect, useCallback } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { useStore } from '@/stores/useStore';
import { useVideoUrl, useVideoFile, usePlayerActions } from '@/stores/selectors';
import { VideoPlayerProvider } from '../context/VideoPlayerContext';

interface VideoPlayerViewProps {
  children?: React.ReactNode;
}

export function VideoPlayerView({ children }: VideoPlayerViewProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  const videoUrl = useVideoUrl();
  const videoFile = useVideoFile();
  const { setCurrentTime, setIsPlaying } = usePlayerActions();

  // Capture MIME type in a ref so it doesn't trigger player re-creation
  const mimeTypeRef = useRef(videoFile?.type || 'video/mp4');
  useEffect(() => {
    mimeTypeRef.current = videoFile?.type || 'video/mp4';
  }, [videoFile?.type]);

  useEffect(() => {
    if (!videoRef.current || !videoUrl) return;

    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-big-play-centered');
    videoRef.current.appendChild(videoElement);

    const player = (playerRef.current = videojs(videoElement, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      volume: 0.4,
      sources: [{
        src: videoUrl,
        type: mimeTypeRef.current,
      }],
      fluid: true,
    }, () => {
      videojs.log('player is ready');

      player.on('loadedmetadata', () => {
        const duration = player.duration();
        if (duration && !isNaN(duration)) {
          useStore.getState().setVideoDuration(duration);
        }
      });

      player.on('timeupdate', () => {
        const currentTime = player.currentTime();
        const state = useStore.getState();

        if (state.player.isScrubbing || player.seeking()) {
          return;
        }

        state.setCurrentTime(currentTime || 0);

        const currentOutPoint = state.timeline.outPoint;
        if ((currentTime || 0) >= currentOutPoint && currentOutPoint > 0 && !player.paused()) {
           player.pause();
           player.currentTime(currentOutPoint);
        }
      });

      player.on('play', () => setIsPlaying(true));
      player.on('pause', () => setIsPlaying(false));
      player.on('ended', () => setIsPlaying(false));
    }));

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [videoUrl, setIsPlaying]); // Only re-create player when URL changes

  // Sync methods
  const play = useCallback(() => {
    playerRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime(time);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (playerRef.current) {
      if (playerRef.current.paused()) {
        playerRef.current.play();
      } else {
        playerRef.current.pause();
      }
    }
  }, []);

  const setIsScrubbing = useStore((state) => state.setIsScrubbing);

  const contextValue = {
    player: playerRef.current,
    play,
    pause,
    seek,
    togglePlay,
    setIsScrubbing,
  };

  return (
    <VideoPlayerProvider value={contextValue}>
      <div className="w-full h-full flex flex-col">
        {/* Video Player Area */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[1200px] mx-auto">
             <div className="relative w-full bg-black rounded overflow-hidden">
             {videoUrl ? (
                 <div ref={videoRef} data-vjs-player /> 
              ) : (
                <div className="text-white p-5 text-center h-full flex items-center justify-center">
                  Loading video...
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Children (Timeline) */}
        {children}
      </div>
    </VideoPlayerProvider>
  );
}
