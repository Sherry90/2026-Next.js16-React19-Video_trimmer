/**
 * Chzzk URL → videoNo 추출 (네트워크 0).
 *
 * YouTube와 달리 Chzzk 썸네일은 videoNo로 결정되지 않는다(akamaized CDN 내부 record ID).
 * 따라서 youtubeThumbnail.ts 같은 "URL→썸네일" 클라이언트 함수는 만들 수 없고,
 * 서버가 Chzzk API(`/service/v2/videos/{videoNo}`)를 호출해 title/thumbnail을 받아야 한다.
 * 이 util은 그 API 호출에 필요한 videoNo 파싱만 담당한다.
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
