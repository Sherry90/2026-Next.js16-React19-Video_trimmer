"use client";

import type { AppError } from "@/types/types";
import { AlertCircleIcon } from "@/shared/ui/icons";
import { Card } from "@/shared/ui/Card";
import { useErrorDisplay } from "../hooks/useErrorDisplay";
import { ErrorDetails } from "./ErrorDetails";
import { ErrorActions } from "./ErrorActions";

interface ErrorDisplayProps {
  error?: AppError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * 에러 표시 카드 (프레젠테이셔널). 표시 결정·복사·핸들러는 useErrorDisplay가 담당.
 * props가 있으면 props를, 없으면 store 에러를 표시.
 */
export function ErrorDisplay(props: ErrorDisplayProps = {}) {
  const {
    displayError,
    showDetails,
    toggleDetails,
    copied,
    showDismiss,
    handleRetry,
    handleDismiss,
    handleCopyReport,
  } = useErrorDisplay(props);

  if (!displayError) {
    return null;
  }

  return (
    <Card variant="red" className="mt-8" data-testid="error-display">
      {/* Error Icon and Title */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <AlertCircleIcon className="w-6 h-6 text-red-600" />
        </div>

        <div className="flex-1">
          {/* User-friendly message + 코드 배지 */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-lg font-semibold text-red-900">{displayError.userMessage}</h3>
            <span
              className="text-xs font-mono px-2 py-0.5 rounded bg-red-200 text-red-800"
              data-testid="error-code"
            >
              {displayError.code}
            </span>
          </div>

          {/* Solution */}
          {displayError.solution && (
            <p className="text-sm text-red-700 mb-4">{displayError.solution}</p>
          )}

          {/* Technical details toggle */}
          {displayError.technicalDetails && (
            <ErrorDetails
              code={displayError.code}
              technicalDetails={displayError.technicalDetails}
              show={showDetails}
              onToggle={toggleDetails}
              copied={copied}
              onCopy={handleCopyReport}
            />
          )}

          {/* Action buttons */}
          <ErrorActions onRetry={handleRetry} onDismiss={showDismiss ? handleDismiss : undefined} />
        </div>
      </div>
    </Card>
  );
}
