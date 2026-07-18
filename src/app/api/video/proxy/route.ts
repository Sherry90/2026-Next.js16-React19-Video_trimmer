import { NextRequest, NextResponse } from "next/server";
import { rewriteM3U8, isHlsResponse } from "@/lib/hlsProxy";

// 일부 CDN 엣지(특히 chzzk)는 UA/Referer 없는 요청을 403한다. yt-dlp가 추출 시
// 부착하는 헤더와 동일 계열을 프록시 upstream fetch에도 붙여 그 클래스의 실패를 방어한다.
const STREAM_FETCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const CHZZK_REFERER = "https://chzzk.naver.com/";

/**
 * upstream에 부착할 헤더.
 *
 * chzzk 스트림만 UA+Referer를 붙인다. chzzk는 navercdn/akamaized 등 호스트가 다양하나
 * 경로에 공통적으로 `/chzzk/`가 있어 이를 신호로 사용한다.
 *
 * youtube/generic에는 추가 헤더를 절대 붙이지 않는다 — googlevideo URL은 특정 클라이언트
 * (c=WEB)용으로 서명돼 있어 UA가 불일치하면 403이 난다. 따라서 youtube는 Range만 전달.
 */
function buildUpstreamHeaders(
  streamUrl: string,
  rangeHeader: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (rangeHeader) headers["Range"] = rangeHeader;

  let isChzzk = false;
  try {
    const u = new URL(streamUrl);
    isChzzk = u.pathname.includes("/chzzk/") || u.hostname.toLowerCase().includes("naver");
  } catch {
    // streamUrl은 상위에서 검증됨
  }
  if (isChzzk) {
    headers["User-Agent"] = STREAM_FETCH_UA;
    headers["Referer"] = CHZZK_REFERER;
  }
  return headers;
}

export async function GET(request: NextRequest) {
  const streamUrl = request.nextUrl.searchParams.get("url");

  if (!streamUrl) {
    return NextResponse.json({ error: "url 파라미터가 필요합니다" }, { status: 400 });
  }

  try {
    // Range(클라 seek) 전달 + chzzk 등 CDN 403 방어용 UA/Referer 부착
    const headers = buildUpstreamHeaders(streamUrl, request.headers.get("range"));

    const response = await fetch(streamUrl, { headers });

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: response.status },
      );
    }

    const upstreamContentType = response.headers.get("content-type");

    // HLS playlist: rewrite inner URIs to route through this proxy (CORS fix)
    if (isHlsResponse(streamUrl, upstreamContentType)) {
      const playlist = await response.text();
      const rewritten = rewriteM3U8(playlist, streamUrl);

      const responseHeaders = new Headers();
      responseHeaders.set("content-type", "application/vnd.apple.mpegurl");
      responseHeaders.set("access-control-allow-origin", "*");
      responseHeaders.set("cache-control", "no-store");

      return new NextResponse(rewritten, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Non-HLS (segments, MP4): byte passthrough with Range support
    const responseHeaders = new Headers();

    const forwardHeaders = ["content-type", "content-length", "content-range", "accept-ranges"];

    for (const header of forwardHeaders) {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    }

    // Ensure Accept-Ranges is set for seeking support
    if (!responseHeaders.has("accept-ranges")) {
      responseHeaders.set("accept-ranges", "bytes");
    }

    // CORS headers (same origin, but explicit for safety)
    responseHeaders.set("access-control-allow-origin", "*");

    return new NextResponse(response.body, {
      status: response.status, // 200 or 206
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[proxy] Error:", error);
    return NextResponse.json({ error: "프록시 요청 실패" }, { status: 502 });
  }
}
