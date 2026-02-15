'use client';

import { useStore } from '@/stores/useStore';
import { formatTime } from '@/utils/timeFormatter';

export function TimeDisplay() {
  const playhead = useStore((state) => state.timeline.playhead);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);

  return (
    <div className="flex items-center justify-center gap-2 text-sm font-mono">
      <span className="text-gray-900 dark:text-gray-100">
        {formatTime(playhead)}
      </span>
      <span className="text-gray-500 dark:text-gray-400">/</span>
      <span className="text-gray-600 dark:text-gray-400">
        {formatTime(duration)}
      </span>
    </div>
  );
}
