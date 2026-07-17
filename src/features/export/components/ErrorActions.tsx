'use client';

import { Button } from '@/shared/ui/Button';

interface ErrorActionsProps {
  onRetry: () => void;
  /** 지정 시 닫기 버튼 노출 */
  onDismiss?: () => void;
}

/**
 * 에러 액션 버튼 그룹 — 다시 시도 / 닫기 (ErrorDisplay 하위).
 */
export function ErrorActions({ onRetry, onDismiss }: ErrorActionsProps) {
  return (
    <div className="flex gap-3 mt-6">
      <Button
        onClick={onRetry}
        data-testid="retry-button"
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
      >
        다시 시도
      </Button>
      {onDismiss && (
        <Button
          onClick={onDismiss}
          className="px-4 py-2 bg-white text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
        >
          닫기
        </Button>
      )}
    </div>
  );
}
