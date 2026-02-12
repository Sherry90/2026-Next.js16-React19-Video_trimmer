'use client';

import { TimeInput } from './TimeInput';
import { LockButton } from './LockButton';
import { PreviewButtons } from './PreviewButtons';

interface TimelineControlsProps {
  inPoint: number;
  outPoint: number;
  duration: number;
  isInPointLocked: boolean;
  isOutPointLocked: boolean;
  onInPointChange: (value: number) => void;
  onOutPointChange: (value: number) => void;
  onInPointLockToggle: () => void;
  onOutPointLockToggle: () => void;
  onPreviewEdges: () => void;
}

/**
 * Timeline controls component containing time inputs, lock buttons, and preview buttons
 * Separated for better organization and testability
 */
export function TimelineControls({
  inPoint,
  outPoint,
  duration,
  isInPointLocked,
  isOutPointLocked,
  onInPointChange,
  onOutPointChange,
  onInPointLockToggle,
  onOutPointLockToggle,
  onPreviewEdges,
}: TimelineControlsProps) {
  return (
    <div className="px-4 pb-4 flex items-center justify-between gap-4">
      {/* Time inputs */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <TimeInput
            label="In"
            value={inPoint}
            onChange={onInPointChange}
            min={0}
            max={outPoint}
            disabled={isInPointLocked}
          />
          <LockButton
            locked={isInPointLocked}
            onToggle={onInPointLockToggle}
            label="In Point"
          />
        </div>
        <div className="flex items-center gap-2">
          <TimeInput
            label="Out"
            value={outPoint}
            onChange={onOutPointChange}
            min={inPoint}
            max={duration}
            disabled={isOutPointLocked}
          />
          <LockButton
            locked={isOutPointLocked}
            onToggle={onOutPointLockToggle}
            label="Out Point"
          />
        </div>
      </div>

      {/* Preview button */}
      <PreviewButtons onPreviewEdges={onPreviewEdges} />
    </div>
  );
}
