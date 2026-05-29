'use client';

import { useRef } from 'react';
import { useStore } from '@/stores/useStore';
import { useTimelineActions } from '@/stores/selectors';
import { TimelineBar } from './TimelineBar';
import { TrimHandle } from './TrimHandle';
import { Playhead } from './Playhead';
import { TimelineControls } from './TimelineControls';
import { usePreviewPlayback } from '../hooks/usePreviewPlayback';
import { useTimelineZoom } from '../hooks/useTimelineZoom';

/**
 * Timeline editor component for video trimming
 * Orchestrates timeline bar, trim handles, playhead, and controls
 */
export function TimelineEditor() {
  const timelineRef = useRef<HTMLDivElement>(null);

  // Get state from store
  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const zoom = useStore((state) => state.timeline.zoom);
  const isInPointLocked = useStore((state) => state.timeline.isInPointLocked);
  const isOutPointLocked = useStore((state) => state.timeline.isOutPointLocked);

  // Actions (identity 불변 → 그룹 셀렉터로 묶어도 재렌더 무해, 스토어 액션 결합 일원화)
  const { setInPoint, setOutPoint, setZoom, setInPointLocked, setOutPointLocked } =
    useTimelineActions();

  // Use custom hooks for preview and zoom functionality
  const { handlePreviewEdges } = usePreviewPlayback(inPoint, outPoint);
  useTimelineZoom(timelineRef, zoom, setZoom);

  return (
    <div ref={timelineRef} className="w-full h-full">
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
