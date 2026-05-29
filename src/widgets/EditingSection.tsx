'use client';

import { useCallback } from 'react';
import { useKeyboardShortcuts } from '@/features/timeline/hooks/useKeyboardShortcuts';
import { usePreviewPlayback } from '@/features/timeline/hooks/usePreviewPlayback';
import { FRAME_STEP, SECOND_STEP } from '@/constants/keyboardShortcuts';
import { VideoPlayerView } from '@/features/player/components/VideoPlayerView';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';
import { TimelineEditor } from '@/features/timeline/components/TimelineEditor';
import { useTrimPoints, useTimelineActions, useVideoDuration } from '@/stores/selectors';
import { useStore } from '@/stores/useStore';

function TimelineWithShortcuts() {
  const { seek, togglePlay } = useVideoPlayerContext();

  const currentTime = useStore((state) => state.player.currentTime);
  const duration = useVideoDuration();
  const { inPoint, outPoint } = useTrimPoints();
  const { setInPoint, setOutPoint } = useTimelineActions();

  // 키보드 preview도 버튼과 동일한 buffer-aware 경로 사용 (스트리밍 stall 방지, 로직 단일화)
  const { handlePreview } = usePreviewPlayback(inPoint, outPoint);

  const handleFrameForward = useCallback(() => seek(Math.min(currentTime + FRAME_STEP, duration)), [currentTime, duration, seek]);
  const handleFrameBackward = useCallback(() => seek(Math.max(currentTime - FRAME_STEP, 0)), [currentTime, seek]);
  const handleSecondForward = useCallback(() => seek(Math.min(currentTime + SECOND_STEP, duration)), [currentTime, duration, seek]);
  const handleSecondBackward = useCallback(() => seek(Math.max(currentTime - SECOND_STEP, 0)), [currentTime, seek]);
  const handleSetInPoint = useCallback(() => setInPoint(currentTime), [currentTime, setInPoint]);
  const handleSetOutPoint = useCallback(() => setOutPoint(currentTime), [currentTime, setOutPoint]);
  const handleJumpToInPoint = useCallback(() => seek(inPoint), [inPoint, seek]);
  const handleJumpToOutPoint = useCallback(() => seek(outPoint), [outPoint, seek]);

  useKeyboardShortcuts({
    onPlayPause: togglePlay,
    onFrameForward: handleFrameForward,
    onFrameBackward: handleFrameBackward,
    onSecondForward: handleSecondForward,
    onSecondBackward: handleSecondBackward,
    onSetInPoint: handleSetInPoint,
    onSetOutPoint: handleSetOutPoint,
    onJumpToInPoint: handleJumpToInPoint,
    onJumpToOutPoint: handleJumpToOutPoint,
    onPreviewMode: handlePreview,
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
