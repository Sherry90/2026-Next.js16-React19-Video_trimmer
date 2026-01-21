'use client';

import { useEffect } from 'react';
import { useStore } from '@/stores/useStore';
import { useFFmpeg } from '@/hooks/useFFmpeg';

// Upload feature
import { UploadZone } from '@/features/upload/components/UploadZone';
import { UploadProgress } from '@/features/upload/components/UploadProgress';
import { FileValidationError } from '@/features/upload/components/FileValidationError';

// Editing section
import { EditingSection } from '@/components/EditingSection';

// Export feature
import { ExportProgress } from '@/features/export/components/ExportProgress';
import { DownloadButton } from '@/features/export/components/DownloadButton';
import { ErrorDisplay } from '@/features/export/components/ErrorDisplay';

export default function HomePage() {
  useFFmpeg();
  const phase = useStore((state) => state.phase);
  const setPhase = useStore((state) => state.setPhase);

  useEffect(() => {
    if (phase === 'ready') {
      setPhase('editing');
    }
  }, [phase, setPhase]);

  return (
    <div className="min-h-screen bg-[#101114] flex flex-col">
      {/* Header */}
      <header className="h-[52px] min-h-[52px] bg-[#101114] border-b border-black flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-[#d9dce3] m-0">
            Video Trimmer
          </h1>
        </div>
        <div className="flex gap-2">
          {(phase === 'ready' || phase === 'editing') && (
            <button
              className="px-[30px] py-[7px] text-[13px] font-medium text-white bg-[#2962ff] border-none rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#0041f5]"
            >
              Export
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Work Area (Video Player) */}
        <div className="flex-1 bg-[#212123] flex items-center justify-center overflow-auto">
          <ErrorDisplay />
          <FileValidationError />

          {phase === 'idle' && <UploadZone />}
          <UploadProgress />
          {(phase === 'ready' || phase === 'editing') && <EditingSection />}
          <ExportProgress />
          <DownloadButton />
        </div>
      </div>
    </div>
  );
}
