'use client';

import { useState } from 'react';
import { useErrorState, useErrorActions, useReset } from '@/stores/hooks';
import type { AppError } from '@/types/types';
import { getErrorDefinition, isErrorCode, formatErrorReport } from '@/shared/lib/errorHandler';
import { AlertCircleIcon, ChevronDownIcon } from '@/shared/ui/icons';

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
  const [copied, setCopied] = useState(false);

  // Use props if provided, otherwise fall back to store
  const storeError = useErrorState();
  const { clearError } = useErrorActions();
  const reset = useReset();

  // Determine which error to show
  let displayError: AppError | null = null;
  if (propError) {
    displayError = propError;
  } else if (storeError.hasError && storeError.errorCode !== 'VALIDATION_ERROR') {
    // store의 free-string code를 ErrorCode로 검증, 정의(해결책)는 단일 소스에서 조회.
    const code = isErrorCode(storeError.errorCode) ? storeError.errorCode : 'UNKNOWN';
    const def = getErrorDefinition(code);

    displayError = {
      code,
      message: storeError.errorMessage || def.message,
      userMessage: storeError.errorMessage || def.userMessage,
      solution: def.solution,
      // 다운로드/서버 에러의 stderr 등 기술 원인. 없으면 메시지로 폴백.
      technicalDetails: storeError.technicalDetails || storeError.errorMessage || undefined,
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

  const handleCopyReport = async () => {
    if (!displayError) return;
    // 복사 시점 timestamp를 정황에 채워 리포트 생성 (버그 공유·원인 추적용).
    const report = formatErrorReport({
      ...displayError,
      context: { ...displayError.context, timestamp: new Date().toISOString() },
    });
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한 불가 환경: 선택 가능한 textarea로 폴백
      const ta = document.createElement('textarea');
      ta.value = report;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-8 p-6 bg-red-50 border border-red-200 rounded-lg" data-testid="error-display">
      {/* Error Icon and Title */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <AlertCircleIcon className="w-6 h-6 text-red-600" />
        </div>

        <div className="flex-1">
          {/* User-friendly message + 코드 배지 */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h3 className="text-lg font-semibold text-red-900">
              {displayError.userMessage}
            </h3>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-200 text-red-800" data-testid="error-code">
              {displayError.code}
            </span>
          </div>

          {/* Solution */}
          {displayError.solution && (
            <p className="text-sm text-red-700 mb-4">{displayError.solution}</p>
          )}

          {/* Technical details toggle */}
          {displayError.technicalDetails && (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
                >
                  <span>
                    {showDetails ? '상세 정보 숨기기' : '상세 정보 보기'}
                  </span>
                  <ChevronDownIcon
                    className={`w-4 h-4 transition-transform ${
                      showDetails ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* 리포트 복사 버튼 — 버그 공유·원인 추적용 */}
                <button
                  onClick={handleCopyReport}
                  data-testid="copy-report-button"
                  className="text-sm text-red-600 hover:text-red-800 underline underline-offset-2"
                >
                  {copied ? '복사됨 ✓' : '리포트 복사'}
                </button>
              </div>

              {showDetails && (
                <div className="mt-3 p-3 bg-red-100 rounded text-xs font-mono text-red-800 overflow-auto max-h-60">
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
