import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { getYtdlpPath, getFfmpegPath } from '@/lib/binPaths';
import { validateUrlParseable } from '@/lib/apiUtils';
import { DOWNLOAD } from '@/constants/appConfig';
import { computeSpectrogram, SpectrogramTooLongError } from '@/lib/spectrogramCompute';

const SAMPLE_RATE = 8000;
const TIMEOUT_MS = 120000;
const MAX_PCM_BYTES = 200 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'url 파라미터가 필요합니다' }, { status: 400 });
  }
  const urlError = validateUrlParseable(url);
  if (urlError) return urlError;

  try {
    const pcm = await extractPcm(getYtdlpPath(), getFfmpegPath(), url, request.signal);
    const data = computeSpectrogram(pcm);
    return NextResponse.json(data, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof SpectrogramTooLongError) {
      return NextResponse.json(
        { skipped: true, reason: 'too_long' },
        { headers: { 'cache-control': 'no-store' } }
      );
    }
    if (request.signal.aborted) {
      return NextResponse.json({ skipped: true, reason: 'aborted' });
    }
    const message = error instanceof Error ? error.message : '스펙트럼 추출 실패';
    console.error('[spectrogram] Error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function extractPcm(ytdlp: string, ffmpeg: string, url: string, signal?: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const dl = spawn(ytdlp, [
      '-f', 'worstaudio/bestaudio/best',
      '--no-playlist',
      '-N', String(DOWNLOAD.YTDLP_CONCURRENT_FRAGMENTS),
      '-P', `temp:${tmpdir()}`,
      '--ffmpeg-location', ffmpeg,
      '-o', '-',
      url,
    ], {
      cwd: tmpdir(),
    });

    const ff = spawn(ffmpeg, [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-ac', '1',
      '-ar', String(SAMPLE_RATE),
      '-f', 's16le',
      'pipe:1',
    ]);

    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    let stderr = '';
    let dlStderr = '';

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      dl.kill('SIGKILL');
      ff.kill('SIGKILL');
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };
    const succeed = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks, total));
    };

    const onAbort = () => fail(new Error('스펙트럼 추출 중단됨'));
    if (signal?.aborted) {
      fail(new Error('스펙트럼 추출 중단됨'));
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    const timer = setTimeout(() => fail(new Error('스펙트럼 추출 시간 초과')), TIMEOUT_MS);

    dl.stdout.pipe(ff.stdin);
    dl.stdout.on('error', () => {});
    ff.stdin.on('error', () => {});

    dl.on('error', (e) => fail(new Error(`yt-dlp 실행 실패: ${e.message}`)));
    ff.on('error', (e) => fail(new Error(`ffmpeg 실행 실패: ${e.message}`)));
    dl.stderr.on('data', (d) => { dlStderr += d.toString(); });
    ff.stderr.on('data', (d) => { stderr += d.toString(); });

    // yt-dlp 비정상 종료(지역차단/비공개/잘못된 URL)는 ff EOF→0바이트로 이어져
    // ffmpeg 일반 에러에 가려진다. dl 종료를 먼저 잡아 진짜 원인을 노출.
    dl.on('close', (code) => {
      if (code !== 0 && code !== null) {
        fail(new Error(dlStderr.trim() || `yt-dlp 종료 코드 ${code}`));
      }
    });

    ff.stdout.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_PCM_BYTES) {
        fail(new SpectrogramTooLongError('오디오가 너무 깁니다'));
        return;
      }
      chunks.push(chunk);
    });

    ff.on('close', (code) => {
      if (code === 0 || (code !== null && total > 0)) {
        succeed();
      } else {
        fail(new Error(stderr.trim() || `ffmpeg 종료 코드 ${code}`));
      }
    });
  });
}
