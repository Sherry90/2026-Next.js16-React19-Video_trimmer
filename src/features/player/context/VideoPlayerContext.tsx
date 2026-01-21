'use client';

import { createContext, useContext, ReactNode, RefObject } from 'react';

interface VideoPlayerContextValue {
  videoRef: RefObject<HTMLVideoElement | null> | null;
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
