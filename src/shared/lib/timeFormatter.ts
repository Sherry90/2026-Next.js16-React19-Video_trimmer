import { TIME } from '@/constants/appConfig';

/**
 * 초 단위 시간을 HH:MM:SS.mmm 또는 HH:MM:SS 형식으로 변환
 * @param includeMs 밀리초 포함 여부 (기본값: true)
 */
export function formatTime(seconds: number, includeMs = true): string {
  const hours = Math.floor(seconds / TIME.SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % TIME.SECONDS_PER_HOUR) / TIME.SECONDS_PER_MINUTE);
  const secs = Math.floor(seconds % TIME.SECONDS_PER_MINUTE);
  const base = [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    secs.toString().padStart(2, '0'),
  ].join(':');

  if (!includeMs) return base;

  const ms = Math.floor((seconds % 1) * TIME.MILLISECONDS_PER_SECOND);
  return base + '.' + ms.toString().padStart(3, '0');
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

  return (
    hours * TIME.SECONDS_PER_HOUR +
    minutes * TIME.SECONDS_PER_MINUTE +
    seconds +
    milliseconds / TIME.MILLISECONDS_PER_SECOND
  );
}

/**
 * 유연한 시간 파싱 - 여러 형식 허용:
 * - 단일 숫자: "90" → 90초
 * - MM:SS 형식: "1:30" → 90초
 * - HH:MM:SS.mmm 형식: "01:02:03.123" → 3723.123초
 *
 * @returns 초 단위 파싱 결과, 유효하지 않은 입력은 0 반환
 */
export function parseFlexibleTime(input: string): number {
  const trimmed = input.trim();

  if (!trimmed) return 0;

  const colonCount = (trimmed.match(/:/g) || []).length;

  // Case 1: 단일 숫자 (초)
  if (colonCount === 0) {
    const seconds = parseFloat(trimmed);
    return isNaN(seconds) || seconds < 0 ? 0 : seconds;
  }

  // Case 2: MM:SS 형식
  if (colonCount === 1) {
    const [minutesPart, secondsPart] = trimmed.split(':');
    const minutes = parseInt(minutesPart, 10);
    const secondsAndMillis = secondsPart.split('.');
    const seconds = parseInt(secondsAndMillis[0], 10);
    const millis = secondsAndMillis[1]
      ? parseInt(secondsAndMillis[1].padEnd(3, '0'), 10)
      : 0;

    if (isNaN(minutes) || isNaN(seconds) || isNaN(millis)) return 0;
    if (minutes < 0 || seconds < 0 || seconds > TIME.MAX_SECONDS_PER_MINUTE || millis < 0) return 0;

    return minutes * TIME.SECONDS_PER_MINUTE + seconds + millis / TIME.MILLISECONDS_PER_SECOND;
  }

  // Case 3: HH:MM:SS 형식
  if (colonCount === 2) {
    return parseTime(trimmed);
  }

  // 유효하지 않음: 콜론이 너무 많음
  return 0;
}

/**
 * 간단한 시간 표시 (MM:SS)
 */
export function formatSimpleTime(seconds: number): string {
  const minutes = Math.floor(seconds / TIME.SECONDS_PER_MINUTE);
  const secs = Math.floor(seconds % TIME.SECONDS_PER_MINUTE);

  const minutesStr = minutes.toString().padStart(2, '0');
  const secsStr = secs.toString().padStart(2, '0');

  return `${minutesStr}:${secsStr}`;
}

/**
 * 시간을 읽기 쉬운 문자열로 변환 (MM:SS 또는 HH:MM:SS)
 * 1시간 미만일 경우 MM:SS, 1시간 이상일 경우 HH:MM:SS 형식 사용
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / TIME.SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % TIME.SECONDS_PER_HOUR) / TIME.SECONDS_PER_MINUTE);
  const secs = Math.floor(seconds % TIME.SECONDS_PER_MINUTE);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
