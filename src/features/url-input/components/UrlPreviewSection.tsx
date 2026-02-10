'use client';

import { useState, useCallback } from 'react';
import { useStore } from '@/stores/useStore';
import { useUrlPreview, useUrlPreviewActions, useProgressActions } from '@/stores/selectors';
import { trimVideoServer } from '@/features/export/utils/trimVideoServer';
import { formatDuration } from '@/features/timeline/utils/timeFormatter';
import { TimeInput } from '@/features/timeline/components/TimeInput';

const MAX_SEGMENT_SECONDS = 600; // 10분

export function UrlPreviewSection() {
  const urlPreview = useUrlPreview();
  const { setUrlPreviewRange, clearUrlPreview } = useUrlPreviewActions();
  const { setTrimProgress } = useProgressActions();
  const setPhase = useStore((state) => state.setPhase);
  const setVideoFile = useStore((state) => state.setVideoFile);
  const setErrorAndTransition = useStore((state) => state.setErrorAndTransition);

  const [isDownloading, setIsDownloading] = useState(false);

  const handleInPointChange = useCallback(
    (value: number) => {
      if (!urlPreview) return;
      // Start 변경 시: outPoint가 새 Start보다 작거나 같으면 자동으로 Start + 10분으로 조정
      const newOut = value >= urlPreview.outPoint
        ? Math.min(value + MAX_SEGMENT_SECONDS, urlPreview.duration)
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

    setIsDownloading(true);
    setTrimProgress(0);

    try {
      const blob = await trimVideoServer({
        originalUrl: urlPreview.originalUrl,
        startTime: urlPreview.inPoint,
        endTime: urlPreview.outPoint,
        filename: `${urlPreview.title || 'video'}.mp4`,
      });

      // Blob -> Object URL -> editing phase
      // URL source는 유지하여 Export 시 서버 트리밍 사용
      const filename = `${urlPreview.title || 'video'}.mp4`;
      const objectUrl = URL.createObjectURL(blob);

      setVideoFile({
        file: null, // URL source는 File 객체 불필요
        source: 'url',
        originalUrl: urlPreview.originalUrl,
        name: filename,
        size: blob.size,
        type: 'video/mp4',
        url: objectUrl,
        duration: 0, // video.js will set the real duration
      });

      setPhase('editing');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '다운로드에 실패했습니다';
      setErrorAndTransition(errorMessage, 'DOWNLOAD_ERROR');
    } finally {
      setIsDownloading(false);
    }
  }, [urlPreview, setTrimProgress, setVideoFile, setPhase, setErrorAndTransition]);

  if (!urlPreview) return null;

  const segmentDuration = urlPreview.outPoint - urlPreview.inPoint;
  const isOverLimit = segmentDuration > MAX_SEGMENT_SECONDS;

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="bg-[#1a1a1e] rounded-lg overflow-hidden border border-white/10">
        {/* Thumbnail */}
        {urlPreview.thumbnail && (
          <div className="relative w-full aspect-video bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urlPreview.thumbnail}
              alt={urlPreview.title}
              className="w-full h-full object-contain"
            />
          </div>
        )}

        {/* Info */}
        <div className="p-5">
          <h3 className="text-[15px] font-medium text-[#d9dce3] mb-1 line-clamp-2">
            {urlPreview.title}
          </h3>
          <p className="text-[12px] text-[#74808c] mb-5">
            {formatDuration(urlPreview.duration)}
            {urlPreview.duration > MAX_SEGMENT_SECONDS && (
              <span className="ml-2 text-amber-400">
                (max {MAX_SEGMENT_SECONDS / 60}min per download)
              </span>
            )}
          </p>

          {/* Range inputs */}
          <div className="flex items-center gap-4 mb-4">
            <TimeInput
              label="Start"
              value={urlPreview.inPoint}
              onChange={handleInPointChange}
              min={0}
              max={urlPreview.duration}
            />
            <TimeInput
              label="End"
              value={urlPreview.outPoint}
              onChange={handleOutPointChange}
              min={urlPreview.inPoint}
              max={urlPreview.duration}
            />
          </div>

          {/* Segment duration display */}
          <p className={`text-[12px] mb-5 ${isOverLimit ? 'text-red-400' : 'text-[#74808c]'}`}>
            Selected: {formatDuration(segmentDuration)}
            {isOverLimit && ' — 10 min limit exceeded'}
          </p>

          {/* Download progress */}
          {isDownloading && (
            <div className="mb-5">
              <div className="w-full">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm text-gray-300 font-medium">
                      서버에서 영상 처리 중...
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      영상 길이에 따라 수 분 소요될 수 있습니다
                    </p>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full animate-pulse-bar" />
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDownloadAndEdit}
              disabled={isDownloading || isOverLimit || segmentDuration <= 0}
              className="flex-1 px-4 py-2.5 text-[13px] font-medium text-white bg-[#2962ff] border-none rounded-sm cursor-pointer transition-colors duration-200 hover:bg-[#0041f5] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDownloading ? 'Processing...' : 'Download & Edit'}
            </button>
            <button
              onClick={clearUrlPreview}
              disabled={isDownloading}
              className="px-4 py-2.5 text-[13px] font-medium text-[#d9dce3] bg-transparent border border-white/20 rounded-sm cursor-pointer transition-colors duration-200 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
