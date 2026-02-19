'use client';

import { formatDuration, formatTime } from '@/utils/timeFormatter';
import { TimeInput } from '@/features/timeline/components/TimeInput';

interface UrlPreviewRangeControlProps {
  inPoint: number | null;
  outPoint: number | null;
  duration: number;
  maxSegment: number;
  segmentDuration: number;
  isEndBeforeStart: boolean;
  isOverLimit: boolean;
  onInPointChange: (value: number | null) => void;
  onOutPointChange: (value: number | null) => void;
}

/**
 * URL 미리보기 범위 제어 (Start/End 입력 + 선택된 구간 표시)
 */
export function UrlPreviewRangeControl({
  inPoint,
  outPoint,
  duration,
  maxSegment,
  segmentDuration,
  isEndBeforeStart,
  isOverLimit,
  onInPointChange,
  onOutPointChange,
}: UrlPreviewRangeControlProps) {
  const resolvedIn = inPoint ?? 0;

  return (
    <div className="p-5 pt-0">
      {/* Range inputs */}
      <div className="flex items-center gap-4 mb-4">
        <TimeInput
          label="Start"
          value={inPoint}
          onChange={onInPointChange}
          min={0}
          max={duration}
          placeholder="00:00:00.000"
          error={isEndBeforeStart}
        />
        <TimeInput
          label="End"
          value={outPoint}
          onChange={onOutPointChange}
          min={resolvedIn}
          max={duration}
          placeholder={formatTime(Math.min(duration, maxSegment))}
          error={isEndBeforeStart}
        />
      </div>

      {/* Segment duration display */}
      <p
        className={`text-[12px] mb-5 ${
          isEndBeforeStart || isOverLimit ? 'text-red-400' : 'text-[#74808c]'
        }`}
      >
        {isEndBeforeStart
          ? 'End must be after start'
          : `Selected: ${formatDuration(segmentDuration)}${isOverLimit ? ` — ${maxSegment / 60} min limit exceeded` : ''}`
        }
      </p>
    </div>
  );
}
