"use client";

import { createContext, useContext, ReactNode } from "react";
import type Player from "video.js/dist/types/player";

/**
 * video.js player 인스턴스 + 제어를 공유하는 컨텍스트.
 * player·timeline 두 feature가 공유하는 계약이므로 shared 레이어에 위치
 * (feature 간 직접 결합을 피하기 위한 승격).
 */
interface VideoPlayerContextValue {
  player: Player | null;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  togglePlay: () => void;
  setIsScrubbing: (scrubbing: boolean) => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

export function VideoPlayerProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: VideoPlayerContextValue;
}) {
  return <VideoPlayerContext.Provider value={value}>{children}</VideoPlayerContext.Provider>;
}

export function useVideoPlayerContext() {
  const context = useContext(VideoPlayerContext);
  if (!context) {
    throw new Error("useVideoPlayerContext must be used within VideoPlayerProvider");
  }
  return context;
}
