import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getYtdlpPath, getFfmpegPath } from '@/lib/binPaths';
import { parseYtdlpError } from '@/utils/apiUtils';
import { selectBestFormat } from '@/lib/formatSelector';
import { toProcessError } from '@/types/process';

const execFileAsync = promisify(execFile);

// 인메모리 resolve 캐시: 같은 URL 재요청을 즉시 응답(yt-dlp 스킵).
// TTL은 스트림 URL 만료(googlevideo ~6h)보다 충분히 짧게 잡아 stale URL 방지.
const RESOLVE_CACHE_TTL_MS = 5 * 60 * 1000;
const resolveCache = new Map<string, { body: Record<string, unknown>; expires: number }>();

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL이 필요합니다' },
        { status: 400 }
      );
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: '유효하지 않은 URL입니다' },
        { status: 400 }
      );
    }

    // 캐시 히트 시 즉시 반환
    const cached = resolveCache.get(url);
    if (cached) {
      if (cached.expires > Date.now()) {
        return NextResponse.json(cached.body);
      }
      resolveCache.delete(url); // lazy 만료
    }

    // Step 1: Get metadata with -J
    const ytdlp = getYtdlpPath();
    const ffmpeg = getFfmpegPath();
    const { stdout: metaJson } = await execFileAsync(ytdlp, [
      '-J',
      '--no-playlist',
      '--ffmpeg-location', ffmpeg,
      url,
    ], {
      timeout: 60000,
      maxBuffer: 50 * 1024 * 1024, // 50MB - yt-dlp JSON can be large
    });

    const info = JSON.parse(metaJson);

    // Step 2: Select best format using format selector
    const formatSelection = selectBestFormat(info);
    let streamUrl = formatSelection?.url || null;
    let streamType = formatSelection?.streamType || 'mp4';

    // Last resort: use --get-url to let yt-dlp choose the best format
    if (!streamUrl) {
      try {
        const { stdout: urlOut } = await execFileAsync(ytdlp, [
          '--get-url',
          '-f', 'b',
          '--no-playlist',
          '--ffmpeg-location', ffmpeg,
          url,
        ], { timeout: 30000 });
        streamUrl = urlOut.trim().split('\n')[0];
      } catch {
        // ignore
      }
    }

    if (!streamUrl) {
      return NextResponse.json(
        { error: '스트림 URL을 추출할 수 없습니다' },
        { status: 422 }
      );
    }

    const body = {
      title: info.title || 'Untitled',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || '',
      url: streamUrl,
      ext: 'mp4',
      streamType,
      tbr: formatSelection?.tbr || null, // Total bitrate (kbps)
    };

    resolveCache.set(url, { body, expires: Date.now() + RESOLVE_CACHE_TTL_MS });
    return NextResponse.json(body);
  } catch (error: unknown) {
    const processError = toProcessError(error);
    const { message, status } = parseYtdlpError(processError);
    console.error('[resolve] Error:', processError.message);
    return NextResponse.json({ error: message }, { status });
  }
}
