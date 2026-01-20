'use client';

import { useCallback } from 'react';
import { useStore } from '@/stores/useStore';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';
import { TimelineBar } from './TimelineBar';
import { InPointHandle } from './InPointHandle';
import { OutPointHandle } from './OutPointHandle';
import { Playhead } from './Playhead';
import { TimeInput } from './TimeInput';
import { TimeDisplay } from './TimeDisplay';

export function TimelineEditor() {
  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const setInPoint = useStore((state) => state.setInPoint);
  const setOutPoint = useStore((state) => state.setOutPoint);

  const { seek, togglePlay, player } = useVideoPlayerContext();

  const handlePreview = useCallback(() => {
    // in point로 이동
    seek(inPoint);
    // 재생 중이 아니면 재생 시작
    if (player?.paused()) {
      togglePlay();
    }
  }, [inPoint, seek, togglePlay, player]);

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Timeline Editor
      </h3>

      {/* 시간 표시 */}
      <TimeDisplay />

      {/* 타임라인 바 */}
      <TimelineBar>
        <InPointHandle />
        <OutPointHandle />
        <Playhead />
      </TimelineBar>

      {/* 시간 입력 */}
      <div className="flex gap-6 justify-center">
        <TimeInput
          label="In Point"
          value={inPoint}
          onChange={setInPoint}
          min={0}
          max={outPoint}
        />
        <TimeInput
          label="Out Point"
          value={outPoint}
          onChange={setOutPoint}
          min={inPoint}
          max={duration}
        />
      </div>

      {/* 미리보기 버튼 */}
      <div className="flex justify-center">
        <button
          onClick={handlePreview}
          className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Preview (A)
        </button>
      </div>
    </div>
  );
}
