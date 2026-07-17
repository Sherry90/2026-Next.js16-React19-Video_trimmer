'use client';

import { usePhase, useReset } from '@/stores/hooks';

export function ResetButton() {
  const phase = usePhase();
  const reset = useReset();

  if (phase !== 'editing') {
    return null;
  }

  return (
    <button
      onClick={reset}
      className="px-[18px] py-[7px] text-[13px] font-medium text-[#d9dce3] bg-transparent border border-[#3a3d45] rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#2a2d35]"
      title="First Page"
      data-testid="reset-button"
    >
      First Page
    </button>
  );
}
