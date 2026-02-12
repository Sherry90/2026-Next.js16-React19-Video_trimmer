'use client';

import { useVideoFile, useTrimPoints, usePhase } from '@/stores/selectors';
import { useExportState } from '../hooks/useExportState';

export function ExportButton() {
  const videoFile = useVideoFile();
  const { inPoint, outPoint } = useTrimPoints();
  const phase = usePhase();

  const { buttonText, buttonTitle, isDisabled, handleExport } = useExportState(
    videoFile,
    inPoint,
    outPoint
  );

  if (phase !== 'editing') {
    return null;
  }

  return (
    <button
      onClick={handleExport}
      className="px-[30px] py-[7px] text-[13px] font-medium text-white bg-[#2962ff] border-none rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#0041f5] disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isDisabled}
      title={buttonTitle}
      data-testid="export-button"
    >
      {buttonText}
    </button>
  );
}
