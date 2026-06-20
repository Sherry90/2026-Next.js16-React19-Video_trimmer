'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useVideoPlayerContext } from '../context/VideoPlayerContext';
import { usePlayheadSeek } from '@/features/timeline/hooks/usePlayheadSeek';
import { useQualityLevels } from '../hooks/useQualityLevels';
import { useFullscreen } from '../hooks/useFullscreen';
import {
  usePlayerCurrentTime,
  usePlayerIsPlaying,
  usePlayerVolume,
  usePlayerActions,
  useVideoDuration,
} from '@/stores/selectors';
import { PlayerControls } from './PlayerControls';

interface PlayerControlBarProps {
  /** 전체화면 타깃(영상+컨트롤을 감싸는 wrapper) */
  wrapperRef: RefObject<HTMLElement | null>;
}

/**
 * 커스텀 컨트롤바 컨테이너 (비순수).
 * 스토어 + VideoPlayerContext + 훅을 프레젠테이셔널 <PlayerControls>에 결선한다.
 * - 스크럽: onScrubStart→setIsScrubbing(true)로 timeupdate 동결, 드래그 중 로컬 표시시간,
 *   릴리스는 usePlayheadSeek.performSeek(seeked 검증)로 setIsScrubbing(false).
 * - 볼륨/뮤트: 스토어 + 실제 player.volume()/muted() 결선(기존엔 미결선).
 * - 화질: useQualityLevels(setSelectedQuality 동기화 유지). 전체화면: useFullscreen.
 */
export function PlayerControlBar({ wrapperRef }: PlayerControlBarProps) {
  const { player, seek, togglePlay, setIsScrubbing } = useVideoPlayerContext();

  const currentTime = usePlayerCurrentTime();
  const isPlaying = usePlayerIsPlaying();
  const duration = useVideoDuration();
  const { volume, isMuted } = usePlayerVolume();
  const { setVolume, setIsMuted } = usePlayerActions();

  const { heights, selected, setQuality } = useQualityLevels(player);
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(wrapperRef);
  const { performSeek } = usePlayheadSeek(player);

  // 드래그 중에는 store currentTime이 동결되므로 thumb는 로컬 표시시간으로 추종
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  // 플레이어 실제 볼륨/뮤트를 스토어에 1회 반영해 UI 초기값을 일치시킨다(config volume:0.4 등).
  const syncedRef = useRef<unknown>(null);
  useEffect(() => {
    if (!player || syncedRef.current === player) return;
    syncedRef.current = player;
    setVolume(player.volume() ?? volume);
    setIsMuted(player.muted() ?? isMuted);
  }, [player, setVolume, setIsMuted, volume, isMuted]);

  const onScrubStart = () => setIsScrubbing(true);
  const onScrub = (t: number) => {
    setScrubTime(t);
    seek(t);
  };
  const onScrubEnd = (t: number) => {
    seek(t);
    performSeek(t, () => {
      setIsScrubbing(false);
      setScrubTime(null);
    });
  };

  const onVolumeChange = (v: number) => {
    setVolume(v);
    player?.volume(v);
    if (v > 0 && isMuted) {
      setIsMuted(false);
      player?.muted(false);
    }
  };
  const onMuteToggle = () => {
    const next = !isMuted;
    setIsMuted(next);
    player?.muted(next);
  };

  return (
    <PlayerControls
      isPlaying={isPlaying}
      currentTime={scrubTime ?? currentTime}
      duration={duration}
      volume={volume}
      isMuted={isMuted}
      qualityHeights={heights}
      selectedQuality={selected}
      isFullscreen={isFullscreen}
      onTogglePlay={togglePlay}
      onScrubStart={onScrubStart}
      onScrub={onScrub}
      onScrubEnd={onScrubEnd}
      onVolumeChange={onVolumeChange}
      onMuteToggle={onMuteToggle}
      onSelectQuality={setQuality}
      onToggleFullscreen={toggleFullscreen}
    />
  );
}
