'use client';

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
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
        </svg>
      )}
    </button>
  );
}
