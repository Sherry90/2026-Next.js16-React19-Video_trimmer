'use client';

import { useStore } from '@/stores/useStore';
import { formatSimpleTime } from '@/features/timeline/utils/timeFormatter';
import { WaveformBackground } from './WaveformBackground';

interface TimelineBarProps {
  children?: React.ReactNode;
}

export function TimelineBar({ children }: TimelineBarProps) {
  const duration = useStore((state) => state.videoFile?.duration ?? 0);
  const inPoint = useStore((state) => state.timeline.inPoint);
  const outPoint = useStore((state) => state.timeline.outPoint);

  const inPosition = duration > 0 ? (inPoint / duration) * 100 : 0;
  const outPosition = duration > 0 ? (outPoint / duration) * 100 : 100;

  return (
    <div className="w-full" style={{ height: '250px' }}>
      {/* Timeline Wrapper with padding */}
      <div className="h-full" style={{ paddingTop: '16px', paddingLeft: '16px', paddingRight: '16px' }}>
        {/* Timeline main area */}
        <div className="relative w-full" style={{ position: 'relative', width: '100%', height: '180px', backgroundColor: '#1c1d20', borderRadius: '4px', overflow: 'hidden' }}>
          {/* Waveform background */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            <WaveformBackground />
          </div>

          {/* Darkened regions (non-selected) */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            {/* Left darkened area (before in point) */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: `${inPosition}%`,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
              }}
            />
            {/* Right darkened area (after out point) */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${outPosition}%`,
                right: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
              }}
            />
          </div>

          {/* Handles and playhead */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
            {children}
          </div>
        </div>

        {/* Time ruler */}
        <div
          className="w-full flex justify-between items-center"
          style={{
            height: '22px',
            marginTop: '12px',
            fontSize: '11px',
            color: '#74808c',
          }}
        >
          <span>{formatSimpleTime(0)}</span>
          <span>{formatSimpleTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
