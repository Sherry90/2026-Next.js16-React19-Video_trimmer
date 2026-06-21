import { isValidSpectrogramData, type SpectrogramData } from './spectrogram';

interface Entry {
  url: string;
  promise: Promise<SpectrogramData>;
  controller: AbortController;
}

let entry: Entry | null = null;

async function fetchSpectrogram(url: string, signal: AbortSignal): Promise<SpectrogramData> {
  const res = await fetch(`/api/video/spectrogram?url=${encodeURIComponent(url)}`, { signal });
  if (!res.ok) {
    throw new Error(`스펙트럼 추출 실패 (${res.status})`);
  }
  const data: unknown = await res.json();
  if (!isValidSpectrogramData(data)) {
    throw new Error('스펙트럼 응답 형식이 올바르지 않습니다');
  }
  return data;
}

export function prefetchSpectrogram(url: string): Promise<SpectrogramData> {
  if (entry?.url === url) return entry.promise;

  if (entry) entry.controller.abort();

  const controller = new AbortController();
  const promise = fetchSpectrogram(url, controller.signal);
  promise.catch(() => {});
  entry = { url, promise, controller };
  return promise;
}

export function getSpectrogram(url: string): Promise<SpectrogramData> {
  if (entry?.url === url) return entry.promise;
  return prefetchSpectrogram(url);
}

export function clearSpectrogram(url?: string): void {
  if (!entry) return;
  if (url && entry.url !== url) return;
  entry.controller.abort();
  entry = null;
}
