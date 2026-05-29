/**
 * 파형 peaks prefetch 캐시 (클라이언트, 모듈 단일-엔트리).
 *
 * URL 입력 즉시 resolve와 **병렬로** 파형 추출을 시작하고 그 Promise를 캐시한다.
 * editing 화면의 WaveformBackground는 새 fetch 대신 이 캐시를 소비 → 진입~표시 공백 제거.
 *
 * 직전 URL 하나만 보관(새 prefetch 시 이전 엔트리 abort+제거)하므로 누수 없음.
 */

export interface WaveformPeaks {
  peaks: number[][];
  duration: number;
}

interface Entry {
  url: string;
  promise: Promise<WaveformPeaks>;
  controller: AbortController;
}

let entry: Entry | null = null;

async function fetchWaveform(url: string, signal: AbortSignal): Promise<WaveformPeaks> {
  const res = await fetch(`/api/video/waveform?url=${encodeURIComponent(url)}`, { signal });
  if (!res.ok) {
    throw new Error(`파형 추출 실패 (${res.status})`);
  }
  return (await res.json()) as WaveformPeaks;
}

/**
 * 파형 추출을 시작(이미 같은 URL이 진행 중이면 재사용)하고 Promise 반환.
 * URL 입력 시 resolve와 동시에 호출한다.
 */
export function prefetchWaveform(url: string): Promise<WaveformPeaks> {
  if (entry?.url === url) return entry.promise;

  // 다른 URL 진행 중이면 중단/제거
  if (entry) entry.controller.abort();

  const controller = new AbortController();
  const promise = fetchWaveform(url, controller.signal);
  // unhandled rejection 방지 (소비처가 없을 때를 대비)
  promise.catch(() => {});
  entry = { url, promise, controller };
  return promise;
}

/**
 * 캐시된 Promise 반환, 없으면 새로 시작 (WaveformBackground 안전망).
 */
export function getWaveform(url: string): Promise<WaveformPeaks> {
  if (entry?.url === url) return entry.promise;
  return prefetchWaveform(url);
}

/**
 * 캐시 정리 + 진행 중 추출 중단. url 지정 시 해당 엔트리만, 생략 시 전체.
 */
export function clearWaveform(url?: string): void {
  if (!entry) return;
  if (url && entry.url !== url) return;
  entry.controller.abort();
  entry = null;
}
