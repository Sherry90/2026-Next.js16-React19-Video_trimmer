'use client';

import { useStore } from '@/stores/useStore';
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
    </div>
  );
}
