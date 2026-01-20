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
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#101114',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        height: '52px',
        minHeight: '52px',
        backgroundColor: '#101114',
        borderBottom: '1px solid #000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{
            fontSize: '14px',
            fontWeight: 600,
            color: '#d9dce3',
            margin: 0,
          }}>
            Video Trimmer
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(phase === 'ready' || phase === 'editing') && (
            <button
              style={{
                padding: '7px 30px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#ffffff',
                backgroundColor: '#2962ff',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0041f5'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2962ff'}
            >
              Export
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Work Area (Video Player) */}
        <div style={{
          flex: 1,
          backgroundColor: '#212123',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
        }}>
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
