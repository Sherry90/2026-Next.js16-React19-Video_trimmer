'use client';

import { RefObject } from 'react';

interface VideoPlayerViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
}

export function VideoPlayerView({ videoRef }: VideoPlayerViewProps) {
  return (
    <div style={{
      width: '100%',
      maxWidth: '1200px',
      margin: '0 auto',
    }}>
      {/* 16:9 aspect ratio container */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%', // 16:9 = 9/16 = 56.25%
        backgroundColor: '#000000',
        borderRadius: '4px',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}>
          <div data-vjs-player style={{ width: '100%', height: '100%' }}>
            <video
              ref={videoRef}
              className="video-js vjs-big-play-centered"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            >
              <p className="vjs-no-js">
                To view this video please enable JavaScript
              </p>
            </video>
          </div>
        </div>
      </div>
    </div>
  );
}
