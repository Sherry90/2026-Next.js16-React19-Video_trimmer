import { NextRequest, NextResponse } from 'next/server';

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

    // Build response headers
    const responseHeaders = new Headers();

    // Forward essential headers from upstream
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
