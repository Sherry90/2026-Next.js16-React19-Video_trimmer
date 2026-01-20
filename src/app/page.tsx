'use client';

import { useStore } from '@/stores/useStore';
import { useFFmpeg } from '@/hooks/useFFmpeg';

// Upload feature
import { UploadZone } from '@/features/upload/components/UploadZone';
import { UploadProgress } from '@/features/upload/components/UploadProgress';
import { FileValidationError } from '@/features/upload/components/FileValidationError';

// Player feature
import { VideoPlayer } from '@/features/player/components/VideoPlayer';

// Timeline feature
import { TimelineEditor } from '@/features/timeline/components/TimelineEditor';

// Export feature
import { ExportButton } from '@/features/export/components/ExportButton';
import { ExportProgress } from '@/features/export/components/ExportProgress';
import { DownloadButton } from '@/features/export/components/DownloadButton';
import { ErrorDisplay } from '@/features/export/components/ErrorDisplay';

export default function HomePage() {
  useFFmpeg(); // FFmpeg 훅 초기화
  const phase = useStore((state) => state.phase);
  const setPhase = useStore((state) => state.setPhase);

  // ready 상태에서 editing으로 전환
  if (phase === 'ready') {
    setPhase('editing');
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* 헤더 */}
        <header className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            Video Trimmer
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Trim videos in your browser
          </p>
        </header>

        {/* 에러 표시 */}
        <ErrorDisplay />

        {/* 파일 검증 에러 */}
        <FileValidationError />

        {/* 업로드 영역 (idle 상태일 때만) */}
        {phase === 'idle' && <UploadZone />}

        {/* 업로드 진행률 */}
        <UploadProgress />

        {/* 편집 화면 (ready 또는 editing 상태일 때) */}
        {(phase === 'ready' || phase === 'editing') && (
          <div className="space-y-8">
            <VideoPlayer />
            <TimelineEditor />
            <div className="flex justify-center">
              <ExportButton />
            </div>
          </div>
        )}

        {/* 처리 진행률 */}
        <ExportProgress />

        {/* 다운로드 버튼 */}
        <DownloadButton />
      </div>
    </main>
  );
}
