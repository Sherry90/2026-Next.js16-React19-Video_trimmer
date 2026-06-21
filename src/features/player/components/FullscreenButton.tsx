'use client';

import { FullscreenEnterIcon, FullscreenExitIcon } from '@/shared/ui/icons';

interface FullscreenButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * 전체화면 토글 버튼 (프레젠테이셔널 — 순수 props).
 * isFullscreen에 따라 enter/exit 아이콘 전환.
 */
export function FullscreenButton({ isFullscreen, onToggle, className = '' }: FullscreenButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
      className={`flex items-center justify-center w-9 h-9 rounded text-white hover:bg-white/10 transition-colors ${className}`}
    >
      {isFullscreen ? (
        <FullscreenExitIcon className="w-5 h-5" />
      ) : (
        <FullscreenEnterIcon className="w-5 h-5" />
      )}
    </button>
  );
}
