'use client';

interface VideoScreenPlaceholderProps {
  label?: string;
  aspectRatio?: string; // e.g. "16 / 9"
  className?: string;
}

/**
 * 영상화면 디자인용 placeholder (프레젠테이셔널 — 순수 props).
 * 실제 재생 엔진(video.js)은 마운트형이라 순수 컴포넌트로 만들 수 없어, 디자인
 * 시스템에는 이 검은 프레임 + 라벨 스탠드인을 노출한다(실 화면은 VideoScreen).
 */
export function VideoScreenPlaceholder({
  label = 'Video preview',
  aspectRatio = '16 / 9',
  className = '',
}: VideoScreenPlaceholderProps) {
  return (
    <div
      className={`relative w-full bg-black rounded overflow-hidden flex items-center justify-center ${className}`}
      style={{ aspectRatio }}
    >
      <div className="flex flex-col items-center gap-2 text-white/30">
        <svg className="w-12 h-12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.29-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
        </svg>
        <span className="text-sm">{label}</span>
      </div>
    </div>
  );
}
