'use client';

import { useCallback } from 'react';
import { useKeyboardShortcuts } from '@/features/timeline/hooks/useKeyboardShortcuts';
import { FRAME_STEP, SECOND_STEP } from '@/constants/keyboardShortcuts';
import { VideoPlayerView } from '@/features/player/components/VideoPlayerView';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';
import { TimelineEditor } from '@/features/timeline/components/TimelineEditor';
import { useStore } from '@/stores/useStore';

function TimelineWithShortcuts() {
  const { seek, togglePlay } = useVideoPlayerContext();

  const currentTime = useStore((state) => state.player.currentTime);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);
  const setInPoint = useStore((state) => state.setInPoint);
  const setOutPoint = useStore((state) => state.setOutPoint);

  const handlePlayPause = useCallback(() => togglePlay(), [togglePlay]);
  const handleFrameForward = useCallback(() => seek(Math.min(currentTime + FRAME_STEP, duration)), [currentTime, duration, seek]);
  const handleFrameBackward = useCallback(() => seek(Math.max(currentTime - FRAME_STEP, 0)), [currentTime, seek]);
  const handleSecondForward = useCallback(() => seek(Math.min(currentTime + SECOND_STEP, duration)), [currentTime, duration, seek]);
  const handleSecondBackward = useCallback(() => seek(Math.max(currentTime - SECOND_STEP, 0)), [currentTime, seek]);
  const handleSetInPoint = useCallback(() => setInPoint(currentTime), [currentTime, setInPoint]);
  const handleSetOutPoint = useCallback(() => setOutPoint(currentTime), [currentTime, setOutPoint]);
  const handleJumpToInPoint = useCallback(() => seek(inPoint), [inPoint, seek]);
  const handleJumpToOutPoint = useCallback(() => seek(outPoint), [outPoint, seek]);
  const handlePreviewMode = useCallback(() => { seek(inPoint); togglePlay(); }, [inPoint, seek, togglePlay]);

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

  return (
    <div className="h-[250px] min-h-[250px] bg-[#101114] border-t border-black">
      <TimelineEditor />
    </div>
  );
}

export function EditingSection() {
  return (
    <VideoPlayerView>
      <TimelineWithShortcuts />
    </VideoPlayerView>
  );
}
