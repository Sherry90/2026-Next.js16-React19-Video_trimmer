import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import { getYtdlpPath, getFfmpegPath } from '@/lib/binPaths';
import { DOWNLOAD, WAVEFORM } from '@/constants/appConfig';

/**
 * Audio-only waveform peaks endpoint.
 *
 * Extracts ONLY the audio track via yt-dlp (piped into ffmpeg → raw PCM),
 * computes a downsampled peak array, and returns it as JSON. This lets the
 * editor show a full waveform without downloading the (much larger) video —
 * aligning with the "stream preview / download segment only on confirm" flow.
 *
 * Independent of the resolve stream URL: re-resolves from the original URL,
 * so it is unaffected by stream-URL expiry/CORS.
 *
 * Pipeline:
 *   yt-dlp -f worstaudio/bestaudio -o - <url>  →  ffmpeg -i pipe:0 -ac 1 -ar 8000 -f s16le pipe:1
 */

const SAMPLE_RATE = 8000; // mono, low rate — enough for a volume envelope
const TIMEOUT_MS = 120000;
const MAX_PCM_BYTES = 200 * 1024 * 1024; // safety cap (~3.4h at 8kHz s16le mono)

/**
 * 소스가 너무 길어 파형을 생략해야 함을 알리는 sentinel.
 * GET 핸들러가 이를 받으면 502가 아닌 `200 {skipped:true}`로 graceful 반환한다.
 */
class WaveformTooLongError extends Error {}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'url 파라미터가 필요합니다' }, { status: 400 });
  }
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: '유효하지 않은 URL입니다' }, { status: 400 });
  }

  const ytdlp = getYtdlpPath();
  const ffmpeg = getFfmpegPath();

  try {
    const pcm = await extractPcm(ytdlp, ffmpeg, url, request.signal);
    const { peaks, duration } = computePeaks(pcm);
    return NextResponse.json(
      { peaks, duration },
      { headers: { 'cache-control': 'no-store' } }
    );
  } catch (error) {
    // 너무 긴 소스: 에러가 아닌 graceful skip (클라가 "파형 생략" 안내)
    if (error instanceof WaveformTooLongError) {
      return NextResponse.json(
        { skipped: true, reason: 'too_long' },
        { headers: { 'cache-control': 'no-store' } }
      );
    }
    // 클라이언트 abort: 이미 떠난 요청 → benign 응답
    if (request.signal.aborted) {
      return NextResponse.json({ skipped: true, reason: 'aborted' });
    }
    const message = error instanceof Error ? error.message : '파형 추출 실패';
    console.error('[waveform] Error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Pipe yt-dlp audio → ffmpeg → raw mono s16le PCM, buffered into memory.
 */
function extractPcm(ytdlp: string, ffmpeg: string, url: string, signal?: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const dl = spawn(ytdlp, [
      '-f', 'worstaudio/bestaudio/best',
      '--no-playlist',
      // HLS 세그먼트 오디오 동시 다운로드 → 긴 소스(Chzzk 등) 추출 가속
      '-N', String(DOWNLOAD.YTDLP_CONCURRENT_FRAGMENTS),
      // 출력이 stdout(`-o -`)이면 yt-dlp가 fragment 임시파일을 outtmpl 기준(=루트)에
      // 떨어뜨린다. temp 경로를 tmp로 명시 격리해 서버 루트 오염 방지
      // (다운로더는 -o가 절대 tmp 경로라 무관). cwd도 tmp로 belt-and-suspenders.
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

    // 클라이언트 abort(예: 길이 게이트가 prefetch 중단) 시 자식 프로세스 즉시 kill
    const onAbort = () => fail(new Error('파형 추출 중단됨'));
    if (signal?.aborted) {
      fail(new Error('파형 추출 중단됨'));
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    const timer = setTimeout(() => fail(new Error('파형 추출 시간 초과')), TIMEOUT_MS);

    dl.stdout.pipe(ff.stdin);
    // EPIPE when ffmpeg exits first — swallow to avoid crashing the route.
    dl.stdout.on('error', () => {});
    ff.stdin.on('error', () => {});

    dl.on('error', (e) => fail(new Error(`yt-dlp 실행 실패: ${e.message}`)));
    ff.on('error', (e) => fail(new Error(`ffmpeg 실행 실패: ${e.message}`)));

    ff.stderr.on('data', (d) => { stderr += d.toString(); });

    ff.stdout.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_PCM_BYTES) {
        fail(new WaveformTooLongError('오디오가 너무 깁니다'));
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

/**
 * Downsample s16le mono PCM into normalized peak values (0..1), each the max
 * absolute amplitude within its bucket. Bucket count scales with duration
 * (WAVEFORM.PEAKS_PER_SEC) so zoomed-in timelines stay sharp, capped at
 * WAVEFORM.MAX_PEAKS to bound the JSON payload. Values are quantized to 3
 * decimals (invisible on a 180px canvas) to roughly third the response size.
 * Returns wavesurfer-shaped peaks (array of one channel) plus exact duration.
 */
function computePeaks(pcm: Buffer): { peaks: number[][]; duration: number } {
  const sampleCount = Math.floor(pcm.length / 2);
  const duration = sampleCount / SAMPLE_RATE;

  if (sampleCount === 0) {
    return { peaks: [[]], duration: 0 };
  }

  const bucketCount = Math.min(
    Math.max(1, Math.round(duration * WAVEFORM.PEAKS_PER_SEC)),
    WAVEFORM.MAX_PEAKS,
    sampleCount
  );
  const samplesPerBucket = sampleCount / bucketCount;
  const peaks = new Array<number>(bucketCount);

  for (let i = 0; i < bucketCount; i++) {
    const start = Math.floor(i * samplesPerBucket);
    const end = Math.min(Math.floor((i + 1) * samplesPerBucket), sampleCount);
    let max = 0;
    for (let s = start; s < end; s++) {
      const v = Math.abs(pcm.readInt16LE(s * 2));
      if (v > max) max = v;
    }
    peaks[i] = Math.round((max / 32768) * 1000) / 1000;
  }

  return { peaks: [peaks], duration };
}
