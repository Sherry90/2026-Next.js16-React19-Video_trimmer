'use client';

import { lazy, Suspense } from 'react';
import { useStore } from '@/stores/useStore';

// Upload feature
import { UploadZone } from '@/features/upload/components/UploadZone';
import { UploadProgress } from '@/features/upload/components/UploadProgress';
import { FileValidationError } from '@/features/upload/components/FileValidationError';

// URL input feature (랜딩에서 UploadZone과 합성)
import { UrlInputZone } from '@/features/url-input/components/UrlInputZone';

// Export feature (eager load button and error, lazy load progress/download)
import { ExportButton } from '@/features/export/components/ExportButton';
import { ErrorDisplay } from '@/features/export/components/ErrorDisplay';

// Editing section은 video.js(~546KB)+wavesurfer를 끌어오므로 editing 진입 전까지
// 초기 번들에서 분리(랜딩/업로드 화면이 무거운 미디어 라이브러리를 안 받음).
const EditingSection = lazy(() => import('@/widgets/EditingSection').then(m => ({ default: m.EditingSection })));

// Lazy load components only needed during/after export to reduce initial bundle
const ExportProgress = lazy(() => import('@/features/export/components/ExportProgress').then(m => ({ default: m.ExportProgress })));
const DownloadButton = lazy(() => import('@/features/export/components/DownloadButton').then(m => ({ default: m.DownloadButton })));

export default function HomePage() {
  const phase = useStore((state) => state.phase);

  return (
    <div className="min-h-screen bg-[#101114] flex flex-col">
      {/* Header */}
      <header className="h-[52px] min-h-[52px] bg-[#101114] border-b border-black flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-[#d9dce3] m-0">
            TrimVideo
          </h1>
        </div>
        <div className="flex gap-2">
          <ExportButton />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Work Area (Video Player) */}
        <div className="flex-1 bg-[#212123] flex items-center justify-center overflow-auto">
          <ErrorDisplay />
          <FileValidationError />

          {phase === 'idle' && (
            <UploadZone>
              <UrlInputZone />
            </UploadZone>
          )}
          <UploadProgress />
          {phase === 'editing' && (
            <Suspense fallback={<div className="text-[#74808c] text-sm">Loading editor…</div>}>
              <EditingSection />
            </Suspense>
          )}
          <Suspense fallback={null}>
            <ExportProgress />
          </Suspense>
          <Suspense fallback={null}>
            <DownloadButton />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
