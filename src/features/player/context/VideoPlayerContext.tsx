'use client';

import { createContext, useContext, ReactNode } from 'react';
import type Player from 'video.js/dist/types/player';

interface VideoPlayerContextValue {
  player: Player | null; // Changed from videoRef to player
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  togglePlay: () => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

export function VideoPlayerProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: VideoPlayerContextValue;
}) {
  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayerContext() {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    throw new Error('useVideoPlayerContext must be used within VideoPlayerProvider');
  }
  return context;
}
