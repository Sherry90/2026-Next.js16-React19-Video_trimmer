'use client';

import { PlayIcon, PauseIcon } from '@/shared/ui/icons';

interface PlayButtonProps {
  isPlaying: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * 재생/일시정지 버튼 (프레젠테이셔널 — 순수 props).
 * isPlaying에 따라 아이콘만 전환한다. video.js 아이콘 폰트 대신 인라인 SVG라
 * Storybook/Claude Design에서도 동일하게 렌더된다.
 */
export function PlayButton({ isPlaying, onToggle, disabled = false, className = '' }: PlayButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={isPlaying ? '일시정지' : '재생'}
      className={`flex items-center justify-center w-9 h-9 rounded text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {isPlaying ? (
        <PauseIcon className="w-5 h-5" />
      ) : (
        <PlayIcon className="w-5 h-5" />
      )}
    </button>
  );
}
