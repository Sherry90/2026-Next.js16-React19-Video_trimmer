import { NextRequest, NextResponse } from 'next/server';
import { getManifest } from '@/lib/manifestStore';

/**
 * resolve가 생성·보관한 DASH MPD를 same-origin 경로로 서빙한다.
 * blob: URL을 쓰면 VHS mpd-parser의 BaseURL 해석이 깨지므로 실제 URL이 필요하다.
 */
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('u');
  if (!key) {
    return NextResponse.json({ error: 'u 파라미터가 필요합니다' }, { status: 400 });
  }
  const mpd = getManifest(key);
  if (!mpd) {
    return NextResponse.json({ error: 'manifest를 찾을 수 없습니다 (만료)' }, { status: 404 });
  }
  return new NextResponse(mpd, {
    status: 200,
    headers: {
      'content-type': 'application/dash+xml',
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    },
  });
}
