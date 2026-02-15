'use client';

import { formatDuration } from '@/utils/timeFormatter';

interface UrlPreviewCardProps {
  title: string;
  thumbnail?: string;
  duration: number;
  maxDuration: number;
}

/**
 * URL 미리보기 카드 (썸네일 + 제목 + 시간)
 */
export function UrlPreviewCard({
  title,
  thumbnail,
  duration,
  maxDuration,
}: UrlPreviewCardProps) {
  return (
    <>
      {/* Thumbnail */}
      {thumbnail && (
        <div className="relative w-full aspect-video bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt={title}
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* Info */}
      <div className="p-5 pb-0">
        <h3 className="text-[15px] font-medium text-[#d9dce3] mb-1 line-clamp-2">
          {title}
        </h3>
        <p className="text-[12px] text-[#74808c] mb-5">
          {formatDuration(duration)}
          {duration > maxDuration && (
            <span className="ml-2 text-amber-400">
              (max {maxDuration / 60}min per download)
            </span>
          )}
        </p>
      </div>
    </>
  );
}
