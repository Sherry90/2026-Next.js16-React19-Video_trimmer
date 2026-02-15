import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getYtdlpPath, getFfmpegPath } from '@/lib/binPaths';
import { parseYtdlpError } from '@/utils/apiUtils';
import { selectBestFormat } from '@/lib/formatSelector';
import { toProcessError } from '@/types/process';

const execFileAsync = promisify(execFile);

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

    return NextResponse.json({
      title: info.title || 'Untitled',
      duration: info.duration || 0,
      thumbnail: info.thumbnail || '',
      url: streamUrl,
      ext: 'mp4',
      streamType,
      tbr: formatSelection?.tbr || null, // Total bitrate (kbps)
    });
  } catch (error: unknown) {
    const processError = toProcessError(error);
    const { message, status } = parseYtdlpError(processError);
    console.error('[resolve] Error:', processError.message);
    return NextResponse.json({ error: message }, { status });
  }
}
