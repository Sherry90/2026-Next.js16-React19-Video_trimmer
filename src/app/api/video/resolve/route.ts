import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getYtdlpPath, getFfmpegPath } from '@/lib/binPaths';

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

    // Step 2: Find the best muxed (video+audio) format from the JSON
    // Prioritize: HLS muxed > HTTPS muxed > any muxed
    let streamUrl: string | null = null;
    let streamType: 'hls' | 'mp4' = 'mp4';

    if (info.formats && info.formats.length > 0) {
      const muxedFormats = info.formats.filter(
        (f: any) => f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none' && f.url
      );

      if (muxedFormats.length > 0) {
        // Prefer HLS (small segments, better for proxy streaming), then HTTPS
        const hlsFormats = muxedFormats
          .filter((f: any) => f.protocol === 'm3u8' || f.protocol === 'm3u8_native')
          .sort((a: any, b: any) => (b.tbr || 0) - (a.tbr || 0));

        const httpsFormats = muxedFormats
          .filter((f: any) => f.protocol === 'https')
          .sort((a: any, b: any) => (b.tbr || 0) - (a.tbr || 0));

        if (hlsFormats.length > 0) {
          streamUrl = hlsFormats[0].url;
          streamType = 'hls';
        } else if (httpsFormats.length > 0) {
          streamUrl = httpsFormats[0].url;
          streamType = 'mp4';
        } else {
          streamUrl = muxedFormats[muxedFormats.length - 1].url;
        }
      }
    }

    // Fallback: use top-level url if available
    if (!streamUrl && info.url) {
      streamUrl = info.url;
    }

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
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'yt-dlp가 설치되어 있지 않습니다. `brew install yt-dlp`로 설치해주세요.' },
        { status: 500 }
      );
    }

    if (error.killed) {
      return NextResponse.json(
        { error: '요청 시간이 초과되었습니다' },
        { status: 504 }
      );
    }

    const stderr = error.stderr || '';
    if (stderr.includes('Unsupported URL')) {
      return NextResponse.json(
        { error: '지원하지 않는 URL입니다' },
        { status: 400 }
      );
    }

    console.error('[resolve] Error:', error.message || error);
    return NextResponse.json(
      { error: '영상 정보를 가져올 수 없습니다' },
      { status: 500 }
    );
  }
}
