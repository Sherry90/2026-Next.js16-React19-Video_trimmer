'use client';

import { lazy, Suspense } from 'react';
import { usePhase, usePhaseActions } from '@/stores/hooks';

// Upload feature
import { UploadZone } from '@/features/upload/components/UploadZone';
import { UploadProgress } from '@/features/upload/components/UploadProgress';
import { FileValidationError } from '@/features/upload/components/FileValidationError';

// URL input feature (랜딩에서 UploadZone과 합성)
import { UrlInputZone } from '@/features/url-input/components/UrlInputZone';

// Export feature (eager load error, lazy load progress/download)
import { ErrorDisplay } from '@/features/export/components/ErrorDisplay';
import { Modal } from '@/shared/ui/Modal';

// Editing section은 video.js(~546KB)+wavesurfer를 끌어오므로 editing 진입 전까지
// 초기 번들에서 분리(랜딩/업로드 화면이 무거운 미디어 라이브러리를 안 받음).
const EditingSection = lazy(() => import('@/widgets/EditingSection').then(m => ({ default: m.EditingSection })));

// Lazy load components only needed during/after export to reduce initial bundle
const ExportProgress = lazy(() => import('@/features/export/components/ExportProgress').then(m => ({ default: m.ExportProgress })));
const DownloadButton = lazy(() => import('@/features/export/components/DownloadButton').then(m => ({ default: m.DownloadButton })));

/**
 * 메인 작업 영역 — phase에 따라 업로드/편집/내보내기 화면을 스위칭.
 * 레이아웃 컨테이너와 phase 분기 렌더를 한곳에 응집(개별 자식은 store phase로 self-gating).
 */
export function WorkArea() {
  const phase = usePhase();
  const { setPhase } = usePhaseActions();

  const isEditorMounted = phase === 'editing' || phase === 'processing' || phase === 'completed';
  const isExportModalOpen = phase === 'processing' || phase === 'completed';

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Work Area (Video Player) */}
      <div className="flex-1 min-h-0 bg-[#212123] flex items-center justify-center overflow-hidden">
        <ErrorDisplay />
        <FileValidationError />

        {phase === 'idle' && (
          <UploadZone>
            <UrlInputZone />
          </UploadZone>
        )}
        <UploadProgress />
        {isEditorMounted && (
          <Suspense fallback={<div className="text-[#74808c] text-sm">Loading editor…</div>}>
            <EditingSection />
          </Suspense>
        )}
        <Modal
          isOpen={isExportModalOpen}
          dismissable={phase === 'completed'}
          onClose={() => setPhase('editing')}
        >
          <Suspense fallback={null}>
            <ExportProgress />
          </Suspense>
          <Suspense fallback={null}>
            <DownloadButton />
          </Suspense>
        </Modal>
      </div>
    </div>
  );
}
