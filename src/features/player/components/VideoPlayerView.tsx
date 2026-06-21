'use client';

import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import videojs from 'video.js';
import 'videojs-contrib-quality-levels';
import type Player from 'video.js/dist/types/player';
import { useStore } from '@/stores/useStore';
import { useVideoUrl, useVideoFile, usePlayerActions } from '@/stores/selectors';
import { VideoPlayerProvider } from '../context/VideoPlayerContext';
import { VideoScreen } from './VideoScreen';
import { PlayerControlBar } from './PlayerControlBar';
import { PlayIcon, PauseIcon } from '@/shared/ui/icons';

interface VideoPlayerViewProps {
  children?: React.ReactNode;
}

export function VideoPlayerView({ children }: VideoPlayerViewProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  // 영상 + 커스텀 컨트롤바를 함께 감싸는 전체화면 타깃
  const wrapperRef = useRef<HTMLDivElement>(null);
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
      // 네이티브 컨트롤바 제거 — 커스텀 React 컨트롤(PlayerControlBar)로 대체
      controls: false,
      autoplay: false,
      preload: 'auto',
      volume: 0.4,
      sources: [{
        src: videoUrl,
        type: mimeTypeRef.current,
      }],
      fluid: true,
      // 후방 버퍼 30초만 유지 → 긴/고화질 영상을 길게 재생해도 MSE SourceBuffer(브라우저 탭
      // media 메모리)가 재생분 전체만큼 무한히 커지지 않게 상한. (측정상 미설정 시 range start가
      // 0에 고정돼 재생분 전체를 보유.)
      backBufferLength: 30,
      html5: {
        vhs: {
          // 기본 true면 작은 플레이어 박스(max-w-1200)에 맞춰 저화질로 고정된다.
          // 고화질/수동 화질 선택을 위해 해제.
          limitRenditionByPlayerDimensions: false,
        },
      },
    }, () => {
      videojs.log('player is ready');

      // context.player가 실제 인스턴스를 받도록 state 갱신 (consumer 재렌더 유발)
      // 화질 선택은 PlayerControlBar의 useQualityLevels 훅이 담당(setSelectedQuality 동기화 유지).
      setPlayer(playerInstance);

      playerInstance.on('loadedmetadata', () => {
        const duration = playerInstance.duration();
        // URL 스트리밍 소스는 resolve 메타데이터로 duration을 미리 설정하므로
        // (이미 >0) 여기서 덮어쓰지 않는다 — 사용자가 정한 outPoint 구간 보존.
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

  // 화면 클릭 플래시: 토글 직후의 새 상태(재생/일시정지) 아이콘을 잠깐 띄운다.
  // id를 매번 갱신해 같은 아이콘 연속 클릭에도 애니메이션이 재시작되게 한다.
  const [flash, setFlash] = useState<{ playing: boolean; id: number } | null>(null);
  const flashIdRef = useRef(0);
  const handleScreenClick = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const willPlay = p.paused(); // 토글 전 paused → 토글 후 재생 상태
    togglePlay();
    setFlash({ playing: willPlay, id: (flashIdRef.current += 1) });
  }, [togglePlay]);

  const setIsScrubbing = useStore((state) => state.setIsScrubbing);

  // 안정적인 context value: player(state)나 콜백이 바뀔 때만 새 객체 → consumer 불필요 재렌더 방지.
  // player를 deps에 포함해야 인스턴스 생성 시 consumer가 갱신됨(누락 시 null-player 버그 재발).
  const contextValue = useMemo(
    () => ({ player, play, pause, seek, togglePlay, setIsScrubbing }),
    [player, play, pause, seek, togglePlay, setIsScrubbing]
  );

  return (
    <VideoPlayerProvider value={contextValue}>
      <div className="w-full h-full flex flex-col">
        {/* Video Player Area — wrapper가 전체화면 타깃(영상 + 컨트롤) */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-[1200px] mx-auto">
            <div ref={wrapperRef} className="relative w-full bg-black rounded overflow-hidden">
              <VideoScreen videoRef={videoRef} hasVideo={!!videoUrl} onScreenClick={handleScreenClick} />
              {flash && (
                <div
                  key={flash.id}
                  className="animate-screen-flash pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                  onAnimationEnd={() => setFlash(null)}
                >
                  <span className="flex items-center justify-center w-20 h-20 rounded-full bg-black/50 text-white">
                    {flash.playing ? (
                      <PlayIcon className="w-10 h-10" />
                    ) : (
                      <PauseIcon className="w-10 h-10" />
                    )}
                  </span>
                </div>
              )}
              {videoUrl && <PlayerControlBar wrapperRef={wrapperRef} />}
            </div>
          </div>
        </div>
        {/* Children (Timeline) */}
        {children}
      </div>
    </VideoPlayerProvider>
  );
}
