interface UrlStatusProps {
  isLoading: boolean;
  error: string | null;
}

/**
 * URL 입력 상태 안내 — 로딩/에러 메시지 + 지원 플랫폼 힌트 (UrlInputZone 하위).
 */
export function UrlStatus({ isLoading, error }: UrlStatusProps) {
  return (
    <>
      {/* Loading State */}
      {isLoading && (
        <p className="mt-2 text-[11px] text-[#2962ff] animate-pulse" data-testid="url-loading">
          영상 정보를 가져오는 중...
        </p>
      )}

      {/* Error State */}
      {error && (
        <p className="mt-2 text-[11px] text-red-400" data-testid="url-error">
          {error}
        </p>
      )}

      {/* Supported platforms hint */}
      <p className="mt-2 text-[10px] text-[#74808c] opacity-50">
        Chzzk, YouTube
      </p>
    </>
  );
}
