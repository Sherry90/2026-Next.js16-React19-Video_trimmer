'use client';

interface PreviewButtonsProps {
  onPreviewFull: () => void;
  onPreviewEdges: () => void;
}

/**
 * Preview buttons for testing the trimmed segment
 * - Preview Full: Plays the entire selected segment
 * - Preview Edges: Plays first 5s + last 5s (or full if <10s)
 */
export function PreviewButtons({ onPreviewFull, onPreviewEdges }: PreviewButtonsProps) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onPreviewFull}
        className="px-6 py-[7px] text-[13px] font-medium text-white bg-white/10 rounded-sm cursor-pointer transition-colors duration-200 hover:bg-white/15"
      >
        Preview Full
      </button>
      <button
        onClick={onPreviewEdges}
        className="px-6 py-[7px] text-[13px] font-medium text-white bg-white/10 rounded-sm cursor-pointer transition-colors duration-200 hover:bg-white/15"
      >
        Preview Edges
      </button>
    </div>
  );
}
