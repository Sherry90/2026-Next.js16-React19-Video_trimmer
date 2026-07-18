"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useVideoPlayerContext } from "@/shared/video-player/VideoPlayerContext";
import { usePlayheadSeek } from "@/shared/video-player/usePlayheadSeek";
import { useQualityLevels } from "../hooks/useQualityLevels";
import { useFullscreen } from "../hooks/useFullscreen";
import {
  usePlayerCurrentTime,
  usePlayerIsPlaying,
  usePlayerVolume,
  usePlayerActions,
  useVideoDuration,
} from "@/stores/hooks";
import { cn } from "@/shared/lib/cn";
import { PlayButton } from "./PlayButton";
import { Scrubber } from "./Scrubber";
import { TimeDisplay } from "./TimeDisplay";
import { VolumeControl } from "./VolumeControl";
import { QualitySelector } from "./QualitySelector";
import { FullscreenButton } from "./FullscreenButton";

interface PlayerControlsProps {
  /** 전체화면 타깃(영상+컨트롤을 감싸는 wrapper). DOM ref라 부모(VideoPlayerView)만 제공 가능. */
  wrapperRef: RefObject<HTMLElement | null>;
  className?: string;
}

/**
 * 커스텀 컨트롤바 (connected). 스토어 + VideoPlayerContext + 훅을 직접 소비하고,
 * 순수 프레젠테이셔널 하위 모듈(PlayButton/Scrubber/…)을 1단계 props로 합성한다.
 * (기존 PlayerControlBar 컨테이너 + PlayerControls 셸의 2단계 pass-through를 하나로 병합.)
 * - 스크럽: onScrubStart→setIsScrubbing(true)로 timeupdate 동결, 드래그 중 로컬 표시시간,
 *   릴리스는 usePlayheadSeek.performSeek(seeked 검증)로 setIsScrubbing(false).
 * - 볼륨/뮤트: 스토어 + 실제 player.volume()/muted() 결선.
 * - 화질: useQualityLevels. 전체화면: useFullscreen.
 */
export function PlayerControls({ wrapperRef, className = "" }: PlayerControlsProps) {
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

  // 플레이어 실제 볼륨/뮤트를 스토어에 1회 반영해 UI 초기값 일치(ready에서 player.volume(DEFAULT_VOLUME) 설정됨).
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

  // 드래그 중엔 로컬 표시시간(scrubTime)을 진행바/시간표시에 함께 반영
  const displayTime = scrubTime ?? currentTime;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 px-3 py-2 pt-6 bg-gradient-to-t from-black/85 via-black/55 to-transparent",
        className,
      )}
    >
      {/* 진행바 — 전체 폭 */}
      <Scrubber
        currentTime={displayTime}
        duration={duration}
        onScrubStart={onScrubStart}
        onScrub={onScrub}
        onScrubEnd={onScrubEnd}
      />
      {/* 컨트롤 행 */}
      <div className="flex items-center gap-2">
        <PlayButton isPlaying={isPlaying} onToggle={togglePlay} />
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={onVolumeChange}
          onMuteToggle={onMuteToggle}
        />
        <TimeDisplay currentTime={displayTime} duration={duration} className="ml-1" />
        <div className="flex-1" />
        <QualitySelector heights={heights} selected={selected} onSelect={setQuality} />
        <FullscreenButton isFullscreen={isFullscreen} onToggle={toggleFullscreen} />
      </div>
    </div>
  );
}
