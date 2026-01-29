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
    <div className="w-full h-[100px]">
      {/* Timeline Wrapper with padding */}
      <div className="h-full pt-4 px-4">
        {/* Timeline main area */}
        <div className="relative w-full h-[80px] bg-[#1c1d20] rounded overflow-hidden">
          {/* Waveform background */}
          <div className="absolute inset-0 pointer-events-none">
            <WaveformBackground />
          </div>

          {/* Darkened regions (non-selected) */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Left darkened area (before in point) */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-black/60"
              style={{
                width: `${inPosition}%`,
              }}
            />
            {/* Right darkened area (after out point) */}
            <div
              className="absolute top-0 bottom-0 right-0 bg-black/60"
              style={{
                left: `${outPosition}%`,
              }}
            />
          </div>

          {/* Handles and playhead */}
          <div className="absolute inset-0">
            {children}
          </div>
        </div>

        {/* Time ruler */}
        <div className="w-full flex justify-between items-center h-[22px] mt-3 text-[11px] text-[#74808c]">
          <span>{formatSimpleTime(0)}</span>
          <span>{formatSimpleTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
