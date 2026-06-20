'use client';

import { PlayButton } from './PlayButton';
import { Scrubber } from './Scrubber';
import { TimeDisplay } from './TimeDisplay';
import { VolumeControl } from './VolumeControl';
import { QualitySelector } from './QualitySelector';
import { FullscreenButton } from './FullscreenButton';

interface PlayerControlsProps {
  // state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered?: number;
  volume: number;
  isMuted: boolean;
  qualityHeights: number[];
  selectedQuality: number | null;
  isFullscreen: boolean;
  // callbacks
  onTogglePlay: () => void;
  onScrubStart: () => void;
  onScrub: (time: number) => void;
  onScrubEnd: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  onSelectQuality: (height: number | null) => void;
  onToggleFullscreen: () => void;
  className?: string;
}

/**
 * 커스텀 컨트롤바 레이아웃 (프레젠테이셔널 — 순수 props).
 * 모든 컨트롤 모듈을 props로 합성한다(TimelineControls가 하위 모듈을 합성하듯).
 * 실제 결선은 PlayerControlBar 컨테이너가 담당.
 */
export function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  buffered,
  volume,
  isMuted,
  qualityHeights,
  selectedQuality,
  isFullscreen,
  onTogglePlay,
  onScrubStart,
  onScrub,
  onScrubEnd,
  onVolumeChange,
  onMuteToggle,
  onSelectQuality,
  onToggleFullscreen,
  className = '',
}: PlayerControlsProps) {
  return (
    <div className={`flex flex-col gap-1 px-3 py-2 bg-[var(--timeline-bg,#1c1d20)] ${className}`}>
      {/* 진행바 — 전체 폭 */}
      <Scrubber
        currentTime={currentTime}
        duration={duration}
        buffered={buffered}
        onScrubStart={onScrubStart}
        onScrub={onScrub}
        onScrubEnd={onScrubEnd}
      />
      {/* 컨트롤 행 */}
      <div className="flex items-center gap-2">
        <PlayButton isPlaying={isPlaying} onToggle={onTogglePlay} />
        <VolumeControl
          volume={volume}
          isMuted={isMuted}
          onVolumeChange={onVolumeChange}
          onMuteToggle={onMuteToggle}
        />
        <TimeDisplay currentTime={currentTime} duration={duration} className="ml-1" />
        <div className="flex-1" />
        <QualitySelector heights={qualityHeights} selected={selectedQuality} onSelect={onSelectQuality} />
        <FullscreenButton isFullscreen={isFullscreen} onToggle={onToggleFullscreen} />
      </div>
    </div>
  );
}
