'use client';

interface PreviewButtonsProps {
  onPreviewEdges: () => void;
}

/**
 * Preview button for testing the trimmed segment edges
 * Plays first 5s + last 5s (or full segment if <10s)
 */
export function PreviewButtons({ onPreviewEdges }: PreviewButtonsProps) {
  return (
    <button
      onClick={onPreviewEdges}
      className="px-6 py-[7px] text-[13px] font-medium text-white bg-white/10 rounded-sm cursor-pointer transition-colors duration-200 hover:bg-white/15"
    >
      Preview Edges
    </button>
  );
}
