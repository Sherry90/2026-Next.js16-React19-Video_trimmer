/**
 * 초 단위 시간을 HH:MM:SS.mmm 형식으로 변환
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  const secsStr = secs.toString().padStart(2, '0');
  const millisecondsStr = milliseconds.toString().padStart(3, '0');

  return `${hoursStr}:${minutesStr}:${secsStr}.${millisecondsStr}`;
}

/**
 * HH:MM:SS.mmm 형식 문자열을 초 단위로 변환
 */
export function parseTime(timeString: string): number {
  const parts = timeString.split(':');
  if (parts.length !== 3) return 0;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const secondsAndMillis = parts[2].split('.');
  const seconds = parseInt(secondsAndMillis[0], 10);
  const milliseconds = secondsAndMillis[1]
    ? parseInt(secondsAndMillis[1].padEnd(3, '0'), 10)
    : 0;

  if (
    isNaN(hours) ||
    isNaN(minutes) ||
    isNaN(seconds) ||
    isNaN(milliseconds)
  ) {
    return 0;
  }

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * 간단한 시간 표시 (MM:SS)
 */
export function formatSimpleTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  const minutesStr = minutes.toString().padStart(2, '0');
  const secsStr = secs.toString().padStart(2, '0');

  return `${minutesStr}:${secsStr}`;
}
