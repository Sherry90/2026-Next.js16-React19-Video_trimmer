'use client';

import { useRef, useState } from 'react';

interface ScrubberProps {
  currentTime: number; // seconds
  duration: number; // seconds
  buffered?: number; // seconds buffered (optional underlay)
  onScrubStart: () => void;
  onScrub: (time: number) => void; // live drag
  onScrubEnd: (time: number) => void;
  className?: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/**
 * 진행바/스크러버 (프레젠테이셔널 — 순수 props).
 * 트랙 DOM rect를 소유해 clientX→시간을 계산하지만, video.js/스토어는 만지지 않고
 * 콜백만 호출한다. Pointer Events로 마우스·터치를 단일 경로로 처리한다.
 */
export function Scrubber({
  currentTime,
  duration,
  buffered,
  onScrubStart,
  onScrub,
  onScrubEnd,
  className = '',
}: ScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const timeFromX = (clientX: number): number => {
    const el = trackRef.current;
    if (!el || duration <= 0) return 0;
    const rect = el.getBoundingClientRect();
    const frac = clamp01((clientX - rect.left) / rect.width);
    return frac * duration;
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onScrubStart();
    onScrub(timeFromX(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    onScrub(timeFromX(e.clientX));
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    onScrubEnd(timeFromX(e.clientX));
  };

  const pct = duration > 0 ? clamp01(currentTime / duration) * 100 : 0;
  const bufPct = duration > 0 && buffered ? clamp01(buffered / duration) * 100 : 0;

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="slider"
      aria-label="재생 위치"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      className={`group relative h-4 flex items-center cursor-pointer touch-none select-none ${className}`}
    >
      {/* track */}
      <div className="relative w-full h-1 rounded-full bg-white/20 overflow-hidden">
        {/* buffered underlay */}
        {bufPct > 0 && <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${bufPct}%` }} />}
        {/* played fill */}
        <div className="absolute inset-y-0 left-0 bg-[var(--primary-blue,#2962ff)]" style={{ width: `${pct}%` }} />
      </div>
      {/* thumb */}
      <div
        className={`absolute w-3 h-3 -ml-1.5 rounded-full bg-[var(--primary-blue,#2962ff)] ring-2 ring-white transition-opacity ${
          dragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
