/**
 * 초를 MMmSSs 형식으로 변환 (1시간 이상이면 HHhMMmSSs)
 */
function formatTime(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) {
    return `${String(h).padStart(2, '0')}h${mm}m${ss}s`;
  }
  return `${mm}m${ss}s`;
}

/**
 * 트림 구간이 포함된 파일명 생성
 * 예: video.mp4 (startTime=150, endTime=310) -> video(02m30s-05m10s).mp4
 */
export function generateTrimFilename(
  originalFilename: string,
  startTime: number,
  endTime: number
): string {
  const suffix = `(${formatTime(startTime)}-${formatTime(endTime)})`;
  const lastDot = originalFilename.lastIndexOf('.');
  if (lastDot === -1) return `${originalFilename}${suffix}`;
  return `${originalFilename.slice(0, lastDot)}${suffix}${originalFilename.slice(lastDot)}`;
}
