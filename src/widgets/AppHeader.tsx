import { ResetButton } from '@/features/export/components/ResetButton';
import { ExportButton } from '@/features/export/components/ExportButton';

/**
 * 앱 상단 헤더 — 로고 + 액션 버튼(Reset/Export) 합성.
 */
export function AppHeader() {
  return (
    <header className="h-[52px] min-h-[52px] bg-[#101114] border-b border-black flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold text-[#d9dce3] m-0">
          TrimVideo
        </h1>
      </div>
      <div className="flex gap-2">
        <ResetButton />
        <ExportButton />
      </div>
    </header>
  );
}
