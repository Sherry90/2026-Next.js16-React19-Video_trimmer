'use client';

import { useEffect, useRef, useCallback } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { useStore } from '@/stores/useStore';

interface UseVideoPlayerOptions {
  onReady?: (player: Player) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: (duration: number) => void;
}

export function useVideoPlayer(options: UseVideoPlayerOptions = {}) {
  const playerRef = useRef<Player | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoFile = useStore((state) => state.videoFile);
  const outPoint = useStore((state) => state.timeline.outPoint);
  const setVideoDuration = useStore((state) => state.setVideoDuration);
  const setCurrentTime = useStore((state) => state.setCurrentTime);
  const setIsPlaying = useStore((state) => state.setIsPlaying);

  // 플레이어 초기화
  useEffect(() => {
    if (!videoRef.current || !videoFile) {
      return;
    }

    // 플레이어 생성
    const player = videojs(videoRef.current, {
      controls: true,
      fluid: true,
      preload: 'auto',
      sources: [
        {
          src: videoFile.url,
          type: videoFile.type,
        },
      ],
    });

    playerRef.current = player;

    // 이벤트 리스너
    player.on('loadedmetadata', () => {
      const duration = player.duration();
      if (duration && !isNaN(duration)) {
        setVideoDuration(duration);
        options.onLoadedMetadata?.(duration);
      }
    });

    player.on('timeupdate', () => {
      const currentTime = player.currentTime();
      if (currentTime !== undefined) {
        setCurrentTime(currentTime);
        options.onTimeUpdate?.(currentTime);

        // out point에 도달하면 자동 정지
        if (currentTime >= outPoint && !player.paused()) {
          player.pause();
          player.currentTime(outPoint);
        }
      }
    });

    player.on('play', () => {
      setIsPlaying(true);
    });

    player.on('pause', () => {
      setIsPlaying(false);
    });

    player.on('ended', () => {
      setIsPlaying(false);
    });

    player.ready(() => {
      options.onReady?.(player);
    });

    // 클린업
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [videoFile, setVideoDuration, setCurrentTime, setIsPlaying, options]);

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

  return {
    videoRef,
    player: playerRef.current,
    play,
    pause,
    seek,
    togglePlay,
  };
}
