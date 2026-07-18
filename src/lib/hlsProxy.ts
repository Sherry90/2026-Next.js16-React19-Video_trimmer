/**
 * HLS(m3u8) 프록시 재작성 유틸.
 *
 * 브라우저가 m3u8 내부의 세그먼트/키/맵 URI를 원본 CDN에서 직접 받으면 CORS로 실패한다.
 * 모든 URI를 우리 프록시(/api/video/proxy)를 경유하도록 재작성한다.
 */

const HLS_CONTENT_TYPES = [
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "audio/mpegurl",
  "audio/x-mpegurl",
];

/**
 * (상대일 수 있는) URI를 플레이리스트 URL 기준 절대주소로 해석 후 프록시 URL로 변환.
 */
export function toProxyUrl(uri: string, baseUrl: string): string {
  const absolute = new URL(uri, baseUrl).toString();
  return `/api/video/proxy?url=${encodeURIComponent(absolute)}`;
}

/**
 * m3u8 본문의 모든 URI를 프록시 경유로 재작성.
 * - 세그먼트 / 중첩 플레이리스트 URI (주석 아닌 비어있지 않은 라인)
 * - #EXT-X-KEY:...URI="..."  및  #EXT-X-MAP:...URI="..." (속성 형태)
 */
export function rewriteM3U8(content: string, baseUrl: string): string {
  const uriAttrRegex = /URI="([^"]+)"/g;

  return content
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return line;

      // 태그 라인: 내부 URI="..." 속성만 재작성 (KEY, MAP 등)
      if (trimmed.startsWith("#")) {
        uriAttrRegex.lastIndex = 0;
        if (!uriAttrRegex.test(trimmed)) return line;
        uriAttrRegex.lastIndex = 0;
        return line.replace(uriAttrRegex, (_m, uri) => `URI="${toProxyUrl(uri, baseUrl)}"`);
      }

      // 일반 URI 라인 (세그먼트 또는 중첩 플레이리스트)
      return toProxyUrl(trimmed, baseUrl);
    })
    .join("\n");
}

/**
 * 응답이 HLS 플레이리스트인지 판별 (content-type 또는 .m3u8 확장자).
 */
export function isHlsResponse(streamUrl: string, contentType: string | null): boolean {
  if (contentType && HLS_CONTENT_TYPES.some((t) => contentType.toLowerCase().includes(t))) {
    return true;
  }
  const path = streamUrl.split("?")[0].toLowerCase();
  return path.endsWith(".m3u8");
}
