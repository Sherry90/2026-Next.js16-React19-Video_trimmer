import { NextRequest, NextResponse } from 'next/server';
import { detectPlatform } from '@/lib/platformDetector';
import { getChzzkVideoNo } from '@/shared/lib/platformUrl';
import { validateUrlParseable } from '@/lib/apiUtils';

/**
 * 즉시 프리뷰 (플랫폼별 메타데이터 소스).
 *
 * resolve(yt-dlp)와 **병렬로** 호출해 URL 입력 직후 제목/썸네일을 빠르게 표시한다.
 * 빈 스피너 체감 제거용. 두 소스 모두 CORS 헤더가 없어 브라우저 직접 fetch가 막히므로
 * 서버에서 프록시한다.
 *
 *  - YouTube → oembed (title + thumbnail_url)
 *  - Chzzk(VOD) → chzzk API `/service/v2/videos/{videoNo}` (videoTitle + thumbnailImageUrl)
 *  - 그 외 / live / 실패 → null (graceful, 클라이언트는 무시)
 */

interface PreviewResult {
  title: string | null;
  thumbnail: string | null;
}

const EMPTY: PreviewResult = { title: null, thumbnail: null };

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'url 파라미터가 필요합니다' }, { status: 400 });
  }
  const urlError = validateUrlParseable(url);
  if (urlError) return urlError;

  try {
    const platform = detectPlatform(url);
    const result =
      platform === 'youtube'
        ? await fetchYoutubePreview(url)
        : platform === 'chzzk'
          ? await fetchChzzkPreview(url)
          : EMPTY;
    return NextResponse.json(result, {
      headers: { 'cache-control': 'public, max-age=300' },
    });
  } catch {
    // 타임아웃/네트워크 → 프리뷰 없이 진행
    return NextResponse.json(EMPTY);
  }
}

async function fetchYoutubePreview(url: string): Promise<PreviewResult> {
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return EMPTY;
  const data = await res.json();
  return { title: data.title ?? null, thumbnail: data.thumbnail_url ?? null };
}

async function fetchChzzkPreview(url: string): Promise<PreviewResult> {
  // VOD(`/video/{videoNo}`)만 대상. live는 null → 프리뷰 skip.
  const videoNo = getChzzkVideoNo(url);
  if (!videoNo) return EMPTY;

  const apiUrl = `https://api.chzzk.naver.com/service/v2/videos/${videoNo}`;
  const res = await fetch(apiUrl, {
    // chzzk API는 User-Agent 없으면 거부할 수 있음
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return EMPTY;
  const data = await res.json();
  const content = data?.content;
  if (!content) return EMPTY;
  return {
    title: content.videoTitle ?? null,
    thumbnail: content.thumbnailImageUrl ?? null,
  };
}
