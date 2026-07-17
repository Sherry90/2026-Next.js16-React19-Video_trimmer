'use client';

import { useCallback } from 'react';
import { usePlayerCurrentTime, useVideoDuration, useTrimPoints, useTrimPointActions } from '@/stores/hooks';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { usePreviewPlayback } from './usePreviewPlayback';
import { stepClamped } from '@/features/timeline/utils/timelineCoords';
import { FRAME_STEP, SECOND_STEP } from '@/constants/keyboardShortcuts';

/**
 * 편집 화면 키보드 단축키 스마트 hook.
 *
 * 프레임/초 이동·in-out 설정·구간 점프의 clamp 계산과 store·player 결선을 흡수해
 * useKeyboardShortcuts에 배선한다. EditingSection은 이 hook 호출 + 레이아웃만 남긴다.
 */
export function useEditingShortcuts(): void {
  const { seek, togglePlay } = useVideoPlayerContext();

  const currentTime = usePlayerCurrentTime();
  const duration = useVideoDuration();
  const { inPoint, outPoint } = useTrimPoints();
  const { setInPoint, setOutPoint } = useTrimPointActions();

  // 키보드 preview도 버튼과 동일한 buffer-aware 경로 사용(스트리밍 stall 방지, 로직 단일화).
  const { handlePreview } = usePreviewPlayback(inPoint, outPoint);

  const handleFrameForward = useCallback(() => seek(stepClamped(currentTime, FRAME_STEP, 0, duration)), [currentTime, duration, seek]);
  const handleFrameBackward = useCallback(() => seek(stepClamped(currentTime, -FRAME_STEP, 0, duration)), [currentTime, duration, seek]);
  const handleSecondForward = useCallback(() => seek(stepClamped(currentTime, SECOND_STEP, 0, duration)), [currentTime, duration, seek]);
  const handleSecondBackward = useCallback(() => seek(stepClamped(currentTime, -SECOND_STEP, 0, duration)), [currentTime, duration, seek]);
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
}
