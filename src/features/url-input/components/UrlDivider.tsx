/**
 * "or paste URL" 구분선 (UrlInputZone 하위, 순수 프레젠테이셔널).
 */
export function UrlDivider() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[11px] text-[#74808c] uppercase tracking-wider">
        or paste URL
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}
