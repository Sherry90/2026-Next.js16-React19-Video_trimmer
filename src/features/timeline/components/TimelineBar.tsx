'use client';

import { useStore } from '@/stores/useStore';
import { formatSimpleTime } from '@/features/timeline/utils/timeFormatter';

interface TimelineBarProps {
  children?: React.ReactNode;
}

export function TimelineBar({ children }: TimelineBarProps) {
  const duration = useStore((state) => state.videoFile?.duration ?? 0);

  return (
    <div className="w-full">
      {/* 시간 표시 */}
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1 px-2">
        <span>{formatSimpleTime(0)}</span>
        <span>{formatSimpleTime(duration)}</span>
      </div>

      {/* 타임라인 바 */}
      <div className="relative w-full h-20 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
        {children}
      </div>
    </div>
  );
}
