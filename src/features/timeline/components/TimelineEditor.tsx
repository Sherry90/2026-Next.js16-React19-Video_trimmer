'use client';

import { useRef } from 'react';
import { useStore } from '@/stores/useStore';
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

  // Get actions from store
  const setInPoint = useStore((state) => state.setInPoint);
  const setOutPoint = useStore((state) => state.setOutPoint);
  const setZoom = useStore((state) => state.setZoom);
  const setInPointLocked = useStore((state) => state.setInPointLocked);
  const setOutPointLocked = useStore((state) => state.setOutPointLocked);

  // Use custom hooks for preview and zoom functionality
  const { handlePreview, handlePreviewEdges } = usePreviewPlayback(inPoint, outPoint);
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
        onInPointChange={setInPoint}
        onOutPointChange={setOutPoint}
        onInPointLockToggle={() => setInPointLocked(!isInPointLocked)}
        onOutPointLockToggle={() => setOutPointLocked(!isOutPointLocked)}
        onPreviewFull={handlePreview}
        onPreviewEdges={handlePreviewEdges}
      />
    </div>
  );
}
