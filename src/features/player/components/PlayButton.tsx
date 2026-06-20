'use client';

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
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="6" y="5" width="4" height="14" rx="1" />
          <rect x="14" y="5" width="4" height="14" rx="1" />
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
        </svg>
      )}
    </button>
  );
}
