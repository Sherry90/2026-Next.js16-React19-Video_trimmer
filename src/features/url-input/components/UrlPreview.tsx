interface UrlPreviewProps {
  thumbnail: string;
  title?: string | null;
}

/**
 * URL resolve 중 즉시 표시하는 썸네일+제목 프리뷰 (UrlInputZone 하위).
 */
export function UrlPreview({ thumbnail, title }: UrlPreviewProps) {
  return (
    <div
      className="mt-3 flex gap-3 items-center rounded-sm overflow-hidden bg-[#1a1a1e] border border-white/10 p-2"
      data-testid="url-preview"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnail}
        alt={title ?? "preview"}
        className="w-24 aspect-video object-cover rounded-sm bg-black shrink-0"
      />
      <p className="text-[12px] text-[#d9dce3] line-clamp-2">
        {title ?? <span className="text-[#74808c] animate-pulse">제목 불러오는 중…</span>}
      </p>
    </div>
  );
}
