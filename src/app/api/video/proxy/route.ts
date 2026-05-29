import { NextRequest, NextResponse } from 'next/server';
import { rewriteM3U8, isHlsResponse } from '@/lib/hlsProxy';

export async function GET(request: NextRequest) {
  const streamUrl = request.nextUrl.searchParams.get('url');

  if (!streamUrl) {
    return NextResponse.json(
      { error: 'url 파라미터가 필요합니다' },
      { status: 400 }
    );
  }

  try {
    // Forward Range header from client for video seeking
    const headers: HeadersInit = {};
    const rangeHeader = request.headers.get('range');
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const response = await fetch(streamUrl, { headers });

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: response.status }
      );
    }

    const upstreamContentType = response.headers.get('content-type');

    // HLS playlist: rewrite inner URIs to route through this proxy (CORS fix)
    if (isHlsResponse(streamUrl, upstreamContentType)) {
      const playlist = await response.text();
      const rewritten = rewriteM3U8(playlist, streamUrl);

      const responseHeaders = new Headers();
      responseHeaders.set('content-type', 'application/vnd.apple.mpegurl');
      responseHeaders.set('access-control-allow-origin', '*');
      responseHeaders.set('cache-control', 'no-store');

      return new NextResponse(rewritten, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Non-HLS (segments, MP4): byte passthrough with Range support
    const responseHeaders = new Headers();

    const forwardHeaders = [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
    ];

    for (const header of forwardHeaders) {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    }

    // Ensure Accept-Ranges is set for seeking support
    if (!responseHeaders.has('accept-ranges')) {
      responseHeaders.set('accept-ranges', 'bytes');
    }

    // CORS headers (same origin, but explicit for safety)
    responseHeaders.set('access-control-allow-origin', '*');

    return new NextResponse(response.body, {
      status: response.status, // 200 or 206
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[proxy] Error:', error);
    return NextResponse.json(
      { error: '프록시 요청 실패' },
      { status: 502 }
    );
  }
}
