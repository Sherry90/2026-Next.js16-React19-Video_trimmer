'use client';

import { useRef, useEffect, useCallback } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { useStore } from '@/stores/useStore';
import { VideoPlayerProvider } from '../context/VideoPlayerContext';

interface VideoPlayerViewProps {
  children?: React.ReactNode;
}

export function VideoPlayerView({ children }: VideoPlayerViewProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  const videoUrl = useStore((state) => state.videoFile?.url);
  const setVideoDuration = useStore((state) => state.setVideoDuration);
  const setCurrentTime = useStore((state) => state.setCurrentTime);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const outPoint = useStore((state) => state.timeline.outPoint);

  useEffect(() => {
    // Determine the video element to use
    // Since we are using video.js, we need to make sure we create the video element 
    // or let video.js handle it. 
    // Best practice for React: render a <video> element (or div) and let video.js wrap it.
    
    if (!videoRef.current || !videoUrl) return;

    // Create a video element dynamically to ensure clean slate for video.js
    const videoElement = document.createElement('video-js');
    videoElement.classList.add('vjs-big-play-centered');
    videoRef.current.appendChild(videoElement);

    const player = (playerRef.current = videojs(videoElement, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      sources: [{
        src: videoUrl,
        type: 'video/mp4' // Assuming mp4 for now based on common uploads, or inferred
      }],
      fluid: true, // Responsiveness
    }, () => {
      videojs.log('player is ready');
      
      // Handle events
      player.on('loadedmetadata', () => {
        const duration = player.duration();
        if (duration && !isNaN(duration)) {
          setVideoDuration(duration);
        }
      });

      player.on('timeupdate', () => {
        const currentTime = player.currentTime();
        const state = useStore.getState();

        // CRITICAL: Ignore timeupdate if scrubbing OR if video is still seeking
        // This prevents stale timeupdate events from overwriting the store
        if (state.player.isScrubbing || player.seeking()) {
          return;
        }

        // Normal playback: update store with video time
        state.setCurrentTime(currentTime || 0);

        // Stop at outPoint logic
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

    // If metadata happens to be loaded already (unlikely with new instance but safe to check)
    // In video.js, 'loadedmetadata' event is reliable.

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, [videoUrl, setVideoDuration, setIsPlaying]); // Removed specific timeline deps to avoid re-init, using getState inside

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
