'use client';

interface VolumeControlProps {
  volume: number; // 0..1
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  className?: string;
}

/**
 * 볼륨 컨트롤 (프레젠테이셔널 — 순수 props).
 * 스피커(뮤트 토글) 버튼 + 볼륨 슬라이더. 표시 볼륨은 isMuted면 0.
 */
export function VolumeControl({ volume, isMuted, onVolumeChange, onMuteToggle, className = '' }: VolumeControlProps) {
  const shown = isMuted ? 0 : volume;
  const muted = isMuted || volume === 0;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={onMuteToggle}
        aria-label={muted ? '음소거 해제' : '음소거'}
        className="flex items-center justify-center w-9 h-9 rounded text-white hover:bg-white/10 transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          {muted ? (
            <path d="M16 9l5 5m0-5l-5 5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none" />
          ) : (
            <path d="M15.5 8.5a4 4 0 0 1 0 7M18 6a7 7 0 0 1 0 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" fill="none" />
          )}
        </svg>
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={shown}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        aria-label="볼륨"
        className="w-20 h-1 accent-[var(--primary-blue,#2962ff)] cursor-pointer"
      />
    </div>
  );
}
