"use client";

import { useVideoFile, useTrimPoints, usePhase } from "@/stores/hooks";
import { Button } from "@/shared/ui/Button";
import { useExportState } from "../hooks/useExportState";

export function ExportButton() {
  const videoFile = useVideoFile();
  const { inPoint, outPoint } = useTrimPoints();
  const phase = usePhase();

  const { buttonText, buttonTitle, isDisabled, handleExport } = useExportState(
    videoFile,
    inPoint,
    outPoint,
  );

  if (phase !== "editing") {
    return null;
  }

  return (
    <Button
      variant="primary"
      onClick={handleExport}
      className="px-[30px] py-[7px] disabled:opacity-50 disabled:cursor-not-allowed"
      disabled={isDisabled}
      title={buttonTitle}
      data-testid="export-button"
    >
      {buttonText}
    </Button>
  );
}
