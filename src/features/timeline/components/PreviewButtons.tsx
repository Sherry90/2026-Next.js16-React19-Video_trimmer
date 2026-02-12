'use client';

interface PreviewButtonsProps {
  onPreviewEdges: () => void;
}

/**
 * Preview button for testing the trimmed segment edges
 * Plays first 5s + last 5s (or full segment if <10s)
 *
 * Visual design: Blue edges on both sides represent the "first" and "last" parts,
 * with arrows pointing to each edge and a semi-transparent center.
 */
export function PreviewButtons({ onPreviewEdges }: PreviewButtonsProps) {
  return (
    <button
      onClick={onPreviewEdges}
      className="flex items-stretch text-[13px] font-medium text-white rounded-sm cursor-pointer transition-colors duration-200 overflow-hidden"
      title="Preview first and last 5 seconds of selected segment"
      aria-label="Preview first and last 5 seconds of selected segment"
    >
      {/* Left edge indicator - full height */}
      <div className="w-6 bg-[#2962ff] flex items-center justify-center">
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 12 12"
        >
          <path d="M9 2 L3 6 L9 10" />
        </svg>
      </div>

      {/* Center text - with background and hover effect */}
      <div className="px-6 py-[7px] bg-white/10 hover:bg-white/15 transition-colors duration-200 flex items-center">
        <span>Preview First & Last 5s</span>
      </div>

      {/* Right edge indicator - full height */}
      <div className="w-6 bg-[#2962ff] flex items-center justify-center">
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 12 12"
        >
          <path d="M3 2 L9 6 L3 10" />
        </svg>
      </div>
    </button>
  );
}
