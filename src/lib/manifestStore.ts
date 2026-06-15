/**
 * 생성된 DASH MPD를 잠깐 보관하는 인메모리 스토어.
 *
 * MPD는 blob: URL로 못 띄운다 — VHS의 mpd-parser가 세그먼트 BaseURL을 manifest URI 기준으로
 * `new URL()` 해석하는데 blob: 기준은 "Failed to construct 'URL'"로 깨진다. 따라서 실제 same-origin
 * 경로(`/api/video/manifest`)로 서빙해야 하고, resolve가 만든 MPD를 이 스토어에 담아 그 경로가 읽는다.
 *
 * 키는 원본 URL. TTL은 resolve 캐시와 동일(스트림 URL 만료보다 짧게).
 */

const TTL_MS = 5 * 60 * 1000;
const store = new Map<string, { mpd: string; expires: number }>();

export function setManifest(key: string, mpd: string): void {
  store.set(key, { mpd, expires: Date.now() + TTL_MS });
}

export function getManifest(key: string): string | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.mpd;
}
