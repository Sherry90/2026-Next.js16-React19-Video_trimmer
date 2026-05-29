'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
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
  // 생성된 player를 state로도 노출 → context.player가 실제 인스턴스를 받는다.
  // (ref 변경은 재렌더를 안 일으켜 context 스냅샷이 null로 고정되던 문제 해결.)
  const [player, setPlayer] = useState<Player | null>(null);

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

    const playerInstance = (playerRef.current = videojs(videoElement, {
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

      // context.player가 실제 인스턴스를 받도록 state 갱신 (consumer 재렌더 유발)
      setPlayer(playerInstance);

      playerInstance.on('loadedmetadata', () => {
        const duration = playerInstance.duration();
        // URL 스트리밍 소스는 resolve 메타데이터로 duration을 미리 설정하므로
        // (이미 >0) 여기서 덮어쓰지 않는다 — outPoint(20분 제한/사용자 구간) 보존.
        // 파일 소스는 duration=0으로 시작하므로 이때 설정된다.
        const hasDuration = (useStore.getState().videoFile?.duration ?? 0) > 0;
        if (!hasDuration && duration && !isNaN(duration)) {
          useStore.getState().setVideoDuration(duration);
        }
      });

      playerInstance.on('timeupdate', () => {
        const currentTime = playerInstance.currentTime();
        const state = useStore.getState();

        if (state.player.isScrubbing || playerInstance.seeking()) {
          return;
        }

        state.setCurrentTime(currentTime || 0);

        const currentOutPoint = state.timeline.outPoint;
        if ((currentTime || 0) >= currentOutPoint && currentOutPoint > 0 && !playerInstance.paused()) {
           playerInstance.pause();
           playerInstance.currentTime(currentOutPoint);
        }
      });

      playerInstance.on('play', () => setIsPlaying(true));
      playerInstance.on('pause', () => setIsPlaying(false));
      playerInstance.on('ended', () => setIsPlaying(false));
    }));

    return () => {
      setPlayer(null);
      if (playerInstance && !playerInstance.isDisposed()) {
        playerInstance.dispose();
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
    player,
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
