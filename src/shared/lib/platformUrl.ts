/**
 * 플랫폼 URL 파싱 유틸 (네트워크 0, 순수 함수).
 *
 * YouTube/Chzzk URL에서 비디오 식별자·썸네일을 추출한다. 클라이언트(즉시 프리뷰)와
 * 서버(/api/video/preview) 양쪽에서 쓰이므로 shared 레이어에 둔다.
 */

/**
 * YouTube URL → 결정적 썸네일 URL.
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

/**
 * Chzzk URL → videoNo 추출.
 *
 * YouTube와 달리 Chzzk 썸네일은 videoNo로 결정되지 않는다(akamaized CDN 내부 record ID).
 * 따라서 "URL→썸네일" 클라이언트 함수는 만들 수 없고, 서버가 Chzzk API
 * (`/service/v2/videos/{videoNo}`)를 호출해 title/thumbnail을 받아야 한다.
 * 이 함수는 그 API 호출에 필요한 videoNo 파싱만 담당한다.
 *
 * VOD(`chzzk.naver.com/video/{videoNo}`)만 대상. live(`/live/{channelId}`)는 별도 API +
 * duration 부재라 프리뷰 비대상 → null 반환.
 */
export function getChzzkVideoNo(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.toLowerCase().includes('chzzk.naver.com')) return null;
    // /video/{videoNo} — videoNo는 숫자
    const m = u.pathname.match(/\/video\/(\d+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}
