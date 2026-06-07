/**
 * YouTube URL → 결정적 썸네일 URL (네트워크 0).
 *
 * 비디오 ID만 추출하면 썸네일 URL이 결정되므로 oembed/resolve를 기다릴 필요 없이
 * 즉시 `<img>`로 표시할 수 있다(이미지 로드는 CORS 무관). YouTube가 아니면 null.
 */
export function getYoutubeThumbnail(url: string): string | null {
  const id = getYoutubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

/**
 * YouTube URL에서 video ID 추출 (watch?v=, youtu.be/, shorts/, embed/).
 */
export function getYoutubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    if (host.includes('youtu.be')) {
      const id = u.pathname.slice(1).split('/')[0];
      return id || null;
    }
    if (host.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      // /shorts/<id>, /embed/<id>
      const m = u.pathname.match(/\/(?:shorts|embed)\/([^/?#]+)/);
      return m ? m[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}
