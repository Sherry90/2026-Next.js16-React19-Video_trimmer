'use client';

import { useCallback } from 'react';
import { useUrlPreview, useUrlPreviewActions } from '@/stores/selectors';
import { UrlPreviewCard } from './UrlPreviewCard';
import { UrlPreviewRangeControl } from './UrlPreviewRangeControl';
import { useStreamDownload } from '../hooks/useStreamDownload';
import { useStore } from '@/stores/useStore';
import { TIMELINE } from '@/constants/appConfig';

export function UrlPreviewSection() {
  const urlPreview = useUrlPreview();
  const { setUrlPreviewRange, clearUrlPreview } = useUrlPreviewActions();
  const { handleDownload, isDownloading } = useStreamDownload();
  const trimProgress = useStore((state) => state.processing.trimProgress);
  const downloadMessage = useStore((state) => state.processing.downloadMessage);
  const downloadPhase = useStore((state) => state.processing.downloadPhase);

  const handleInPointChange = useCallback(
    (value: number) => {
      if (!urlPreview) return;
      // Start 변경 시: outPoint가 새 Start보다 작거나 같으면 자동으로 Start + 10분으로 조정
      const newOut = value >= urlPreview.outPoint
        ? Math.min(value + TIMELINE.MAX_SEGMENT_DURATION_SECONDS, urlPreview.duration)
        : urlPreview.outPoint;
      setUrlPreviewRange(value, newOut);
    },
    [urlPreview, setUrlPreviewRange]
  );

  const handleOutPointChange = useCallback(
    (value: number) => {
      if (!urlPreview) return;
      setUrlPreviewRange(urlPreview.inPoint, value);
    },
    [urlPreview, setUrlPreviewRange]
  );

  const handleDownloadAndEdit = useCallback(async () => {
    if (!urlPreview) return;
    await handleDownload(urlPreview);
  }, [urlPreview, handleDownload]);

  if (!urlPreview) return null;

  const segmentDuration = urlPreview.outPoint - urlPreview.inPoint;
  const isOverLimit = segmentDuration > TIMELINE.MAX_SEGMENT_DURATION_SECONDS;

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="bg-[#1a1a1e] rounded-lg overflow-hidden border border-white/10">
        <UrlPreviewCard
          title={urlPreview.title}
          thumbnail={urlPreview.thumbnail}
          duration={urlPreview.duration}
          maxDuration={TIMELINE.MAX_SEGMENT_DURATION_SECONDS}
        />

        <UrlPreviewRangeControl
          inPoint={urlPreview.inPoint}
          outPoint={urlPreview.outPoint}
          duration={urlPreview.duration}
          maxSegment={TIMELINE.MAX_SEGMENT_DURATION_SECONDS}
          onInPointChange={handleInPointChange}
          onOutPointChange={handleOutPointChange}
        />

        {/* Download progress */}
        <div className="p-5 pt-0">
          {isDownloading && (
            <div className="mb-5">
              <div className="w-full space-y-2">
                {/* Phase indicator */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-gray-200">
                      {downloadPhase === 'downloading' && '다운로드 중...'}
                      {downloadPhase === 'processing' && '처리 중...'}
                      {downloadPhase === 'completed' && '완료!'}
                      {!downloadPhase && '준비 중...'}
                    </p>
                    <p className="text-xs text-gray-400">
                      {downloadMessage || '서버에서 영상 처리 중...'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-blue-500">
                      {Math.round(trimProgress)}%
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-300"
                    style={{ width: `${trimProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          {!isDownloading && (
            <div className="flex gap-3">
              <button
                onClick={handleDownloadAndEdit}
                disabled={isOverLimit || segmentDuration <= 0}
                className="flex-1 px-4 py-2.5 text-[13px] font-medium text-white bg-[#2962ff] border-none rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#0041f5] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download & Edit
              </button>
              <button
                onClick={clearUrlPreview}
                className="px-4 py-2.5 text-[13px] font-medium text-[#d9dce3] bg-transparent border border-white/20 rounded-sm cursor-pointer transition-colors duration-200 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
