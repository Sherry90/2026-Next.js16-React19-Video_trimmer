'use client';

import { useEffect } from 'react';
import { useVideoPlayer } from '@/features/player/hooks/useVideoPlayer';
import 'video.js/dist/video-js.css';

export function VideoPlayer() {
  const { videoRef } = useVideoPlayer();

  // Video.js CSS 동적 로드
  useEffect(() => {
    // Video.js는 이미 import되어 있으므로 추가 로드 불필요
  }, []);

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
