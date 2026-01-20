'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '@/stores/useStore';
import { useVideoPlayerContext } from '@/features/player/context/VideoPlayerContext';
import { TimelineBar } from './TimelineBar';
import { InPointHandle } from './InPointHandle';
import { OutPointHandle } from './OutPointHandle';
import { Playhead } from './Playhead';
import { TimeInput } from './TimeInput';
import { LockButton } from './LockButton';

export function TimelineEditor() {
  const timelineRef = useRef<HTMLDivElement>(null);

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
    const segmentDuration = outPoint - inPoint;

    if (segmentDuration < 10) {
      handlePreview();
      return;
    }

    const firstSegmentEnd = inPoint + 5;

    seek(inPoint);
    if (player?.paused()) {
      togglePlay();
    }

    const checkTime = () => {
      if (!player) return;

      const currentTime = player.currentTime();
      if (currentTime !== undefined && currentTime >= firstSegmentEnd) {
        const secondSegmentStart = outPoint - 5;
        seek(secondSegmentStart);
        player.off('timeupdate', checkTime);
      }
    };

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

  return (
    <div ref={timelineRef} style={{ width: '100%', height: '100%' }}>
      {/* Timeline Bar */}
      <TimelineBar>
        <InPointHandle />
        <OutPointHandle />
        <Playhead />
      </TimelineBar>

      {/* Controls - positioned at bottom */}
      <div style={{
        padding: '0 16px 16px 16px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Time inputs */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handlePreview}
            style={{
              padding: '7px 24px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#ffffff',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
          >
            Preview Full
          </button>
          <button
            onClick={handlePreviewEdges}
            style={{
              padding: '7px 24px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#ffffff',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
          >
            Preview Edges
          </button>
        </div>
      </div>
    </div>
  );
}
