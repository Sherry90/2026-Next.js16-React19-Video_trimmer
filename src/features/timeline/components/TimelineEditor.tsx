'use client';

import {
  useTrimPoints,
  useVideoDuration,
  useTrimLocks,
  useTimelineActions,
} from '@/stores/hooks';
import { TimelineBar } from './TimelineBar';
import { TrimHandle } from './TrimHandle';
import { Playhead } from './Playhead';
import { TimelineControls } from './TimelineControls';
import { usePreviewPlayback } from '../hooks/usePreviewPlayback';

/**
 * Timeline editor component for video trimming
 * Orchestrates timeline bar, trim handles, playhead, and controls
 */
export function TimelineEditor() {
  // Get state from store hooks
  const { inPoint, outPoint } = useTrimPoints();
  const duration = useVideoDuration();
  const { isInPointLocked, isOutPointLocked } = useTrimLocks();

  // Actions (identity 불변 → 그룹 셀렉터로 묶어도 재렌더 무해, 스토어 액션 결합 일원화)
  // 줌은 TimelineBar(viewport 소유)의 useTimelineZoom에서 처리.
  const { setInPoint, setOutPoint, setInPointLocked, setOutPointLocked } =
    useTimelineActions();

  // Use custom hooks for preview playback
  const { handlePreviewEdges } = usePreviewPlayback(inPoint, outPoint);

  return (
    <div className="w-full h-full">
      {/* Timeline Bar */}
      <TimelineBar>
        <TrimHandle type="in" />
        <TrimHandle type="out" />
        <Playhead />
      </TimelineBar>

      {/* Controls */}
      <TimelineControls
        inPoint={inPoint}
        outPoint={outPoint}
        duration={duration}
        isInPointLocked={isInPointLocked}
        isOutPointLocked={isOutPointLocked}
        onInPointChange={(value) => { if (value !== null) setInPoint(value); }}
        onOutPointChange={(value) => { if (value !== null) setOutPoint(value); }}
        onInPointLockToggle={() => setInPointLocked(!isInPointLocked)}
        onOutPointLockToggle={() => setOutPointLocked(!isOutPointLocked)}
        onPreviewEdges={handlePreviewEdges}
      />
    </div>
  );
}
