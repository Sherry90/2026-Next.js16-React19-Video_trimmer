'use client';

import { cn } from '@/shared/lib/cn';
import { ChevronDownIcon } from '@/shared/ui/icons';
import { Button } from '@/shared/ui/Button';

interface ErrorDetailsProps {
  code: string;
  technicalDetails: string;
  show: boolean;
  onToggle: () => void;
  copied: boolean;
  onCopy: () => void;
}

/**
 * 에러 상세 정보 토글 + 리포트 복사 블록 (ErrorDisplay 하위).
 */
export function ErrorDetails({ code, technicalDetails, show, onToggle, copied, onCopy }: ErrorDetailsProps) {
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <Button
          onClick={onToggle}
          className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
        >
          <span>{show ? '상세 정보 숨기기' : '상세 정보 보기'}</span>
          <ChevronDownIcon className={cn('w-4 h-4 transition-transform', show && 'rotate-180')} />
        </Button>

        {/* 리포트 복사 버튼 — 버그 공유·원인 추적용 */}
        <Button
          onClick={onCopy}
          data-testid="copy-report-button"
          className="text-sm text-red-600 hover:text-red-800 underline underline-offset-2"
        >
          {copied ? '복사됨 ✓' : '리포트 복사'}
        </Button>
      </div>

      {show && (
        <div className="mt-3 p-3 bg-red-100 rounded text-xs font-mono text-red-800 overflow-auto max-h-60">
          <p className="text-xs font-semibold mb-1">Error Code: {code}</p>
          <p className="whitespace-pre-wrap break-all">{technicalDetails}</p>
        </div>
      )}
    </div>
  );
}
