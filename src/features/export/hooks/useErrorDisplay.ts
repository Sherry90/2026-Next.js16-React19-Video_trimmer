"use client";

import { useState } from "react";
import { useErrorState, useErrorActions, useReset } from "@/stores/hooks";
import type { AppError } from "@/types/types";
import { getErrorDefinition, isErrorCode, formatErrorReport } from "@/shared/lib/errorHandler";

interface UseErrorDisplayArgs {
  error?: AppError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

/**
 * ErrorDisplay의 표시 결정·복사·재시도/닫기 로직 캡슐화.
 * props가 있으면 props를, 없으면 store 에러를 표시(이중 모드). 컴포넌트는 표시만 담당.
 */
export function useErrorDisplay({
  error: propError,
  onRetry: propOnRetry,
  onDismiss: propOnDismiss,
}: UseErrorDisplayArgs) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const storeError = useErrorState();
  const { clearError } = useErrorActions();
  const reset = useReset();

  // 표시할 에러 결정: props 우선, 없으면 store(단 VALIDATION_ERROR는 FileValidationError 담당이라 제외)
  let displayError: AppError | null = null;
  if (propError) {
    displayError = propError;
  } else if (storeError.hasError && storeError.errorCode !== "VALIDATION_ERROR") {
    // store의 free-string code를 ErrorCode로 검증, 정의(해결책)는 단일 소스에서 조회.
    const code = isErrorCode(storeError.errorCode) ? storeError.errorCode : "UNKNOWN";
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
      const ta = document.createElement("textarea");
      ta.value = report;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    }
  };

  return {
    displayError,
    showDetails,
    toggleDetails: () => setShowDetails((v) => !v),
    copied,
    // 닫기 버튼 노출 조건: 외부 onDismiss가 있거나, store 모드일 때
    showDismiss: Boolean(propOnDismiss) || !propError,
    handleRetry,
    handleDismiss,
    handleCopyReport,
  };
}
