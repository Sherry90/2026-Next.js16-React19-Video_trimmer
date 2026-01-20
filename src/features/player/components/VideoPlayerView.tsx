'use client';

import { RefObject } from 'react';
import 'video.js/dist/video-js.css';

interface VideoPlayerViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function VideoPlayerView({ videoRef }: VideoPlayerViewProps) {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div data-vjs-player>
        <video
          ref={videoRef}
          className="video-js vjs-big-play-centered"
        />
      </div>
    </div>
  );
}
