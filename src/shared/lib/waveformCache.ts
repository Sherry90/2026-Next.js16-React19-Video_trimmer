/**
 * 파형 peaks prefetch 캐시 (클라이언트, 모듈 단일-엔트리).
 *
 * URL 입력 즉시 resolve와 **병렬로** 파형 추출을 시작하고 그 Promise를 캐시한다.
 * editing 화면의 WaveformBackground는 새 fetch 대신 이 캐시를 소비 → 진입~표시 공백 제거.
 *
 * 직전 URL 하나만 보관(새 prefetch 시 이전 엔트리 abort+제거)하므로 누수 없음.
 */

import { WAVEFORM } from '@/constants/appConfig';

export interface WaveformPeaks {
  peaks: number[][];
  duration: number;
  /** 길이 초과 등으로 서버/클라가 파형을 생략한 경우 true */
  skipped?: boolean;
}

/**
 * 주어진 길이(초)가 파형 생략 임계값을 넘는지. 클라이언트 길이 게이트 + 테스트용 순수 함수.
 */
export function shouldSkipWaveform(durationSec: number): boolean {
  return durationSec > WAVEFORM.MAX_DURATION_SEC;
}

/**
 * peaks 를 videoDuration 길이에 맞게 스케일.
 *
 * WaveSurfer 는 `duration` 옵션과 무관하게 peaks 배열을 컨테이너 폭에 가득 펴서 그린다.
 * 따라서 추출된 오디오 길이(audioDuration)가 videoDuration 과 다르면 파형이 playhead 와
 * 어긋난다. 이를 막기 위해 peaks 길이를 videoDuration 기준으로 맞춘다:
 * - audio < video: 오른쪽을 0(무음)으로 패딩 → 파형이 좌측만 채우고 우측 여백(스펙트럴과 동일).
 * - audio > video: video 길이만큼 잘라냄.
 */
export function scalePeaksToDuration(
  peaks: number[][],
  audioDuration: number,
  videoDuration: number
): number[][] {
  if (audioDuration <= 0 || videoDuration <= 0 || audioDuration === videoDuration) {
    return peaks;
  }
  return peaks.map((channel) => {
    if (channel.length === 0) return channel;
    const targetLen = Math.max(1, Math.round(channel.length * (videoDuration / audioDuration)));
    if (targetLen === channel.length) return channel;
    if (targetLen < channel.length) return channel.slice(0, targetLen);
    const padded = channel.slice();
    for (let i = channel.length; i < targetLen; i++) padded.push(0);
    return padded;
  });
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
  const data = (await res.json()) as WaveformPeaks;
  // 서버가 길이 초과 등으로 생략한 경우: 빈 peaks + skipped 플래그
  if (data.skipped) {
    return { peaks: [[]], duration: 0, skipped: true };
  }
  return data;
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
