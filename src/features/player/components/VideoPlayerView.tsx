'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useStore } from '@/stores/useStore';
import { VideoPlayerProvider } from '../context/VideoPlayerContext';

interface VideoPlayerViewProps {
  children?: React.ReactNode;
}

export function VideoPlayerView({ children }: VideoPlayerViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrl = useStore((state) => state.videoFile?.url);
  const setVideoDuration = useStore((state) => state.setVideoDuration);
  const setCurrentTime = useStore((state) => state.setCurrentTime);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const outPoint = useStore((state) => state.timeline.outPoint);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const duration = video.duration;
      if (duration && !isNaN(duration)) {
        setVideoDuration(duration);
      }
    };

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      setCurrentTime(currentTime);

      // Stop at outPoint
      if (currentTime >= outPoint && outPoint > 0 && !video.paused) {
        video.pause();
        video.currentTime = outPoint;
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    // If metadata already loaded
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoUrl, setVideoDuration, setCurrentTime, setIsPlaying, outPoint]);

  const play = useCallback(() => {
    videoRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  }, []);

  const contextValue = {
    videoRef,
    play,
    pause,
    seek,
    togglePlay,
  };

  return (
    <VideoPlayerProvider value={contextValue}>
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Video Player Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div
            style={{
              width: '100%',
              maxWidth: '1200px',
              margin: '0 auto',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                paddingBottom: '56.25%',
                backgroundColor: '#000000',
                borderRadius: '4px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                }}
              >
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <div style={{ color: 'white', padding: '20px', textAlign: 'center' }}>
                    Loading video...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Children (Timeline) */}
        {children}
      </div>
    </VideoPlayerProvider>
  );
}
