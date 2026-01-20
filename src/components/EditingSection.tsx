'use client';

import { useCallback } from 'react';
import { useVideoPlayer } from '@/features/player/hooks/useVideoPlayer';
import { useKeyboardShortcuts } from '@/features/timeline/hooks/useKeyboardShortcuts';
import { FRAME_STEP, SECOND_STEP } from '@/constants/keyboardShortcuts';
import { VideoPlayerProvider } from '@/features/player/context/VideoPlayerContext';
import { VideoPlayerView } from '@/features/player/components/VideoPlayerView';
import { TimelineEditor } from '@/features/timeline/components/TimelineEditor';
import { ExportButton } from '@/features/export/components/ExportButton';
import { useStore } from '@/stores/useStore';

export function EditingSection() {
  const { videoRef, player, play, pause, seek, togglePlay } = useVideoPlayer();

  const currentTime = useStore((state) => state.player.currentTime);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);
  const setInPoint = useStore((state) => state.setInPoint);
  const setOutPoint = useStore((state) => state.setOutPoint);

  // 키보드 단축키 핸들러
  const handlePlayPause = useCallback(() => {
    togglePlay();
  }, [togglePlay]);

  const handleFrameForward = useCallback(() => {
    const newTime = Math.min(currentTime + FRAME_STEP, duration);
    seek(newTime);
  }, [currentTime, duration, seek]);

  const handleFrameBackward = useCallback(() => {
    const newTime = Math.max(currentTime - FRAME_STEP, 0);
    seek(newTime);
  }, [currentTime, seek]);

  const handleSecondForward = useCallback(() => {
    const newTime = Math.min(currentTime + SECOND_STEP, duration);
    seek(newTime);
  }, [currentTime, duration, seek]);

  const handleSecondBackward = useCallback(() => {
    const newTime = Math.max(currentTime - SECOND_STEP, 0);
    seek(newTime);
  }, [currentTime, seek]);

  const handleSetInPoint = useCallback(() => {
    setInPoint(currentTime);
  }, [currentTime, setInPoint]);

  const handleSetOutPoint = useCallback(() => {
    setOutPoint(currentTime);
  }, [currentTime, setOutPoint]);

  const handleJumpToInPoint = useCallback(() => {
    seek(inPoint);
  }, [inPoint, seek]);

  const handleJumpToOutPoint = useCallback(() => {
    seek(outPoint);
  }, [outPoint, seek]);

  const handlePreviewMode = useCallback(() => {
    // 미리보기: in point로 이동하고 재생 시작
    seek(inPoint);
    togglePlay();
  }, [inPoint, seek, togglePlay]);

  // 키보드 단축키 등록
  useKeyboardShortcuts({
    onPlayPause: handlePlayPause,
    onFrameForward: handleFrameForward,
    onFrameBackward: handleFrameBackward,
    onSecondForward: handleSecondForward,
    onSecondBackward: handleSecondBackward,
    onSetInPoint: handleSetInPoint,
    onSetOutPoint: handleSetOutPoint,
    onJumpToInPoint: handleJumpToInPoint,
    onJumpToOutPoint: handleJumpToOutPoint,
    onPreviewMode: handlePreviewMode,
  });

  const videoPlayerValue = {
    player,
    play,
    pause,
    seek,
    togglePlay,
  };

  return (
    <VideoPlayerProvider value={videoPlayerValue}>
      <div className="space-y-8">
        <VideoPlayerView videoRef={videoRef} />
        <TimelineEditor />
        <div className="flex justify-center">
          <ExportButton />
        </div>
      </div>
    </VideoPlayerProvider>
  );
}
