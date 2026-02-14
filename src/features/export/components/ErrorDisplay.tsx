'use client';

import { useState } from 'react';
import { useStore } from '@/stores/useStore';
import type { AppError } from '@/types/types';

interface ErrorDisplayProps {
  error?: AppError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorDisplay({
  error: propError,
  onRetry: propOnRetry,
  onDismiss: propOnDismiss,
}: ErrorDisplayProps = {}) {
  const [showDetails, setShowDetails] = useState(false);

  // Use props if provided, otherwise fall back to store
  const storeError = useStore((state) => state.error);
  const clearError = useStore((state) => state.clearError);
  const reset = useStore((state) => state.reset);

  // Determine which error to show
  let displayError: AppError | null = null;
  if (propError) {
    displayError = propError;
  } else if (storeError.hasError && storeError.errorCode !== 'VALIDATION_ERROR') {
    // Convert old error format to new AppError format
    // Validate error code or use UNKNOWN
    const errorCode = storeError.errorCode as any;
    const validErrorCode: import('@/types/types').ErrorCode =
      errorCode === 'MEMORY_INSUFFICIENT' ||
      errorCode === 'CODEC_UNSUPPORTED' ||
      errorCode === 'FILE_CORRUPTED' ||
      errorCode === 'FFMPEG_LOAD_FAILED' ||
      errorCode === 'PROCESSING_FAILED'
        ? errorCode
        : 'UNKNOWN';

    displayError = {
      code: validErrorCode,
      message: storeError.errorMessage || 'Unknown error',
      userMessage: storeError.errorMessage || '알 수 없는 오류가 발생했습니다.',
      technicalDetails: storeError.errorMessage || undefined,
    };
  }

  if (!displayError) {
    return null;
  }

  const handleRetry = () => {
    if (propOnRetry) {
      propOnRetry();
    } else {
      clearError();
      reset();
    }
  };

  const handleDismiss = () => {
    if (propOnDismiss) {
      propOnDismiss();
    } else {
      clearError();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 p-6 bg-red-50 border border-red-200 rounded-lg" data-testid="error-display">
      {/* Error Icon and Title */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div className="flex-1">
          {/* User-friendly message */}
          <h3 className="text-lg font-semibold text-red-900 mb-2">
            {displayError.userMessage}
          </h3>

          {/* Solution */}
          {displayError.solution && (
            <p className="text-sm text-red-700 mb-4">{displayError.solution}</p>
          )}

          {/* Technical details toggle */}
          {displayError.technicalDetails && (
            <div className="mt-4">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <span>
                  {showDetails ? '상세 정보 숨기기' : '상세 정보 보기'}
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    showDetails ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showDetails && (
                <div className="mt-3 p-3 bg-red-100 rounded text-xs font-mono text-red-800 overflow-auto max-h-40">
                  <p className="text-xs font-semibold mb-1">
                    Error Code: {displayError.code}
                  </p>
                  <p className="whitespace-pre-wrap break-all">
                    {displayError.technicalDetails}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleRetry}
              data-testid="retry-button"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              다시 시도
            </button>
            {(propOnDismiss || !propError) && (
              <button
                onClick={handleDismiss}
                className="px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
