'use client';

import { formatDuration } from '@/utils/timeFormatter';
import { TimeInput } from '@/features/timeline/components/TimeInput';

interface UrlPreviewRangeControlProps {
  inPoint: number;
  outPoint: number;
  duration: number;
  maxSegment: number;
  onInPointChange: (value: number) => void;
  onOutPointChange: (value: number) => void;
}

/**
 * URL 미리보기 범위 제어 (Start/End 입력 + 선택된 구간 표시)
 */
export function UrlPreviewRangeControl({
  inPoint,
  outPoint,
  duration,
  maxSegment,
  onInPointChange,
  onOutPointChange,
}: UrlPreviewRangeControlProps) {
  const segmentDuration = outPoint - inPoint;
  const isOverLimit = segmentDuration > maxSegment;

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
        />
        <TimeInput
          label="End"
          value={outPoint}
          onChange={onOutPointChange}
          min={inPoint}
          max={duration}
        />
      </div>

      {/* Segment duration display */}
      <p
        className={`text-[12px] mb-5 ${
          isOverLimit ? 'text-red-400' : 'text-[#74808c]'
        }`}
      >
        Selected: {formatDuration(segmentDuration)}
        {isOverLimit && ` — ${maxSegment / 60} min limit exceeded`}
      </p>
    </div>
  );
}
