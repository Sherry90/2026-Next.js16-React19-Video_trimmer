'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/stores/useStore';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';
import { TimelineBar } from './TimelineBar';
import { TrimHandle } from './TrimHandle';
import { Playhead } from './Playhead';
import { TimeInput } from './TimeInput';
import { LockButton } from './LockButton';

export function TimelineEditor() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const previewCheckTimeRef = useRef<(() => void) | null>(null);

  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const zoom = useStore((state) => state.timeline.zoom);
  const isInPointLocked = useStore((state) => state.timeline.isInPointLocked);
  const isOutPointLocked = useStore((state) => state.timeline.isOutPointLocked);
  const setInPoint = useStore((state) => state.setInPoint);
  const setOutPoint = useStore((state) => state.setOutPoint);
  const setZoom = useStore((state) => state.setZoom);
  const setInPointLocked = useStore((state) => state.setInPointLocked);
  const setOutPointLocked = useStore((state) => state.setOutPointLocked);

  const { seek, togglePlay, player } = useVideoPlayerContext();

  const handlePreview = useCallback(() => {
    seek(inPoint);
    if (player?.paused()) {
      togglePlay();
    }
  }, [inPoint, seek, togglePlay, player]);

  const handlePreviewEdges = useCallback(() => {
    // Clean up any existing preview listener
    if (previewCheckTimeRef.current && player) {
      player.off('timeupdate', previewCheckTimeRef.current);
      previewCheckTimeRef.current = null;
    }

    const segmentDuration = outPoint - inPoint;

    if (segmentDuration < 10) {
      handlePreview();
      return;
    }

    const firstSegmentEnd = inPoint + 5;
    let isTransitioning = false;

    seek(inPoint);
    if (player?.paused()) {
      togglePlay();
    }

    const checkTime = () => {
      if (!player) return;

      const currentTime = player.currentTime();
      if (currentTime !== undefined && currentTime >= firstSegmentEnd && !isTransitioning) {
        isTransitioning = true;
        const secondSegmentStart = outPoint - 5;
        player.pause();
        seek(secondSegmentStart);

        // Wait for seek to complete before resuming playback
        const seekedHandler = () => {
          player.play();
          player.off('seeked', seekedHandler);
        };
        player.on('seeked', seekedHandler);

        player.off('timeupdate', checkTime);
        previewCheckTimeRef.current = null;
      }
    };

    previewCheckTimeRef.current = checkTime;
    player?.on('timeupdate', checkTime);
  }, [inPoint, outPoint, seek, togglePlay, player, handlePreview]);

  // Timeline zoom functionality (Ctrl + wheel)
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = zoom + zoomDelta;
      setZoom(newZoom);
    };

    const timelineElement = timelineRef.current;
    if (timelineElement) {
      timelineElement.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (timelineElement) {
        timelineElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, [zoom, setZoom]);

  // Cleanup preview listener on unmount
  useEffect(() => {
    return () => {
      if (previewCheckTimeRef.current && player) {
        player.off('timeupdate', previewCheckTimeRef.current);
        previewCheckTimeRef.current = null;
      }
    };
  }, [player]);

  return (
    <div ref={timelineRef} className="w-full h-full">
      {/* Timeline Bar */}
      <TimelineBar>
        <TrimHandle type="in" />
        <TrimHandle type="out" />
        <Playhead />
      </TimelineBar>

      {/* Controls - positioned at bottom */}
      <div className="px-4 pb-4 flex items-center justify-between gap-4">
        {/* Time inputs */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <TimeInput
              label="In"
              value={inPoint}
              onChange={setInPoint}
              min={0}
              max={outPoint}
              disabled={isInPointLocked}
            />
            <LockButton
              locked={isInPointLocked}
              onToggle={() => setInPointLocked(!isInPointLocked)}
              label="In Point"
            />
          </div>
          <div className="flex items-center gap-2">
            <TimeInput
              label="Out"
              value={outPoint}
              onChange={setOutPoint}
              min={inPoint}
              max={duration}
              disabled={isOutPointLocked}
            />
            <LockButton
              locked={isOutPointLocked}
              onToggle={() => setOutPointLocked(!isOutPointLocked)}
              label="Out Point"
            />
          </div>
        </div>

        {/* Preview buttons */}
        <div className="flex gap-2">
          <button
            onClick={handlePreview}
            className="px-6 py-[7px] text-[13px] font-medium text-white bg-white/10 rounded-sm cursor-pointer transition-colors duration-200 hover:bg-white/15"
          >
            Preview Full
          </button>
          <button
            onClick={handlePreviewEdges}
            className="px-6 py-[7px] text-[13px] font-medium text-white bg-white/10 rounded-sm cursor-pointer transition-colors duration-200 hover:bg-white/15"
          >
            Preview Edges
          </button>
        </div>
      </div>
    </div>
  );
}
