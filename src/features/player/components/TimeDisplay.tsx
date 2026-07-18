"use client";

import { formatDuration } from "@/shared/lib/timeFormatter";

interface TimeDisplayProps {
  currentTime: number; // seconds
  duration: number; // seconds
  className?: string;
}

/**
 * 현재 시간 / 총 길이 표시 (프레젠테이셔널 — 순수 props).
 * 2-3(현재 시간) + 2-4(영상 길이)를 한 쌍으로 표시. formatDuration 재사용.
 */
export function TimeDisplay({ currentTime, duration, className = "" }: TimeDisplayProps) {
  return (
    <div
      className={`text-xs tabular-nums text-white/90 select-none whitespace-nowrap ${className}`}
    >
      <span>{formatDuration(Math.max(0, currentTime))}</span>
      <span className="text-white/40"> / </span>
      <span className="text-white/60">{formatDuration(Math.max(0, duration))}</span>
    </div>
  );
}
