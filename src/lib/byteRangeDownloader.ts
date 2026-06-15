/**
 * DASH 단일파일 byte-range 다운로더.
 *
 * 전체 소스를 받지 않고, 클립 구간에 해당하는 **바이트만** HTTP Range로 받는다(긴 영상의 짧은
 * 클립에서 수십 배 데이터 절감). 동작:
 *   1. yt-dlp -J → DASH avc1 video + mp4a audio 표현 선택(selectDashFormats)
 *   2. 각 표현 머리(128KB) 받아 init(ftyp+moov)·sidx 범위 파싱(parseInitIndexRange)
 *   3. sidx 파싱(parseSidx) → subsegment 시간·바이트 표 → 구간 바이트범위 계산(computeClipByteRange)
 *   4. init(머리에 이미 있음) + media range만 받아 조립 → 유효 fmp4(v/a)
 *   5. ffmpeg로 정밀 컷+mux(-c copy) → outputPath
 *
 * DASH 단일파일(sidx)이 아니거나 파싱 실패 시 throw → 호출부가 전체 다운로드로 폴백.
 */

import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import { promises as fsPromises } from 'fs';
import { getFfmpegPath, getYtdlpPath } from './binPaths';
import { runWithTimeout } from './processUtils';
import { PROCESS, DOWNLOAD } from '@/constants/appConfig';
import { selectDashFormats } from './formatSelector';
import { parseInitIndexRange, parseSidx, computeClipByteRange } from './dashManifest';

const execFileAsync = promisify(execFile);
const DASH_HEAD_BYTES = 131072; // 128KB — ftyp+moov+sidx 담기 충분 (resolve와 동일)

async function fetchRange(url: string, start: number, end: number, signal?: AbortSignal): Promise<Buffer> {
  // 잡 abort + 자체 타임아웃 결합 — 응답 없는 소켓에 무한히 매달리지 않게(서버 보호).
  const timeout = AbortSignal.timeout(DOWNLOAD.RANGE_FETCH_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: combined });
  if (!res.ok && res.status !== 206) {
    throw new Error(`range fetch 실패 (${res.status})`);
  }
  return Buffer.from(await res.arrayBuffer());
}

interface RepPlan {
  head: Buffer;
  init: [number, number];
  media: [number, number];
  clipStartTime: number;
  mediaBytes: number;
}

/** 머리(128KB)만 받아 init/sidx 파싱 → 구간 바이트 범위 계산. media는 아직 안 받음(크기 가드용). */
async function planRep(url: string, startSec: number, endSec: number, signal?: AbortSignal): Promise<RepPlan> {
  const head = await fetchRange(url, 0, DASH_HEAD_BYTES - 1, signal);
  const { init, index } = parseInitIndexRange(head);
  const sidx = parseSidx(head, index[0], index[1]);
  const { media, clipStartTime } = computeClipByteRange(sidx, init, startSec, endSec);
  return { head, init, media, clipStartTime, mediaBytes: media[1] - media[0] + 1 };
}

/** plan대로 init(머리에 있음)+media range를 받아 fmp4로 조립. */
async function writeRepClip(url: string, plan: RepPlan, outFile: string, signal?: AbortSignal): Promise<void> {
  const initBuf = plan.head.subarray(plan.init[0], plan.init[1] + 1);
  const mediaBuf = await fetchRange(url, plan.media[0], plan.media[1], signal);
  await fsPromises.writeFile(outFile, Buffer.concat([initBuf, mediaBuf]));
}

/**
 * byte-range로 구간 클립을 outputPath에 생성한다. 비호환/실패 시 throw(호출부 폴백).
 * @param reportProgress 0~100 진행률 콜백(다운로드 단계 대략치)
 */
export async function downloadClipByteRange(
  params: {
    jobId: string;
    url: string;
    startTime: number;
    endTime: number;
    outputPath: string;
    maxHeight?: number;
  },
  signal: AbortSignal | undefined,
  reportProgress: (percent: number) => void
): Promise<void> {
  const { jobId, url, startTime, endTime, outputPath, maxHeight } = params;

  const ytdlp = getYtdlpPath();
  if (!ytdlp) throw new Error('yt-dlp 미설치');

  // 1) 메타데이터 → DASH 표현 선택
  reportProgress(5);
  const { stdout: metaJson } = await execFileAsync(
    ytdlp,
    ['-J', '--no-playlist', '--ffmpeg-location', getFfmpegPath(), url],
    { timeout: 60000, maxBuffer: 50 * 1024 * 1024, signal }
  );
  const info = JSON.parse(metaJson);
  const sel = selectDashFormats(info as never, maxHeight && maxHeight > 0 ? maxHeight : 1080);
  if (!sel || sel.video.length === 0) {
    throw new Error('DASH(avc1+mp4a) 표현 없음 — byte-range 불가');
  }
  // 가장 높은 화질(maxHeight 이하, selectDashFormats가 이미 필터·오름차순 정렬)
  const video = sel.video[sel.video.length - 1];
  const audio = sel.audio;

  // 사전 가드: 큰 클립(긴 영상 전체/대부분)은 byte-range가 비효율(전체를 메모리 적재)이고
  // 단일 Range fetch가 느려 타임아웃 낭비. metadata(duration+bitrate)로 fetch 전에 폴백 결정.
  const totalDur = typeof info.duration === 'number' ? info.duration : 0;
  const clipDur = endTime - startTime;
  const estBytes = Math.round(((video.bandwidth + audio.bandwidth) / 8) * clipDur);
  if (totalDur > 0 && (clipDur >= totalDur * 0.5 || estBytes > DOWNLOAD.MAX_BYTERANGE_BYTES)) {
    throw new Error(
      `큰 클립(${clipDur}s/${totalDur}s, ~${Math.round(estBytes / 1048576)}MB) — byte-range 스킵, 전체 다운로드 폴백`
    );
  }

  const vFile = `${outputPath}.v.mp4`;
  const aFile = `${outputPath}.a.mp4`;
  try {
    // 2) 머리만 받아 구간 바이트 범위 계획 (media 미수신). 크기 가드 먼저.
    reportProgress(15);
    const [vPlan, aPlan] = await Promise.all([
      planRep(video.url, startTime, endTime, signal),
      planRep(audio.url, startTime, endTime, signal),
    ]);
    const totalBytes = vPlan.mediaBytes + aPlan.mediaBytes;
    if (totalBytes > DOWNLOAD.MAX_BYTERANGE_BYTES) {
      // 큰 범위(긴 영상/큰 클립): arrayBuffer 통째 적재 비효율·OOM 위험 → 폴백(aria2c→디스크).
      throw new Error(
        `byte-range 범위가 큼(${Math.round(totalBytes / 1048576)}MB > ${Math.round(DOWNLOAD.MAX_BYTERANGE_BYTES / 1048576)}MB) — 전체 다운로드로 폴백`
      );
    }

    // 3) media range 받아 조립 (video, audio 병렬)
    reportProgress(30);
    await Promise.all([
      writeRepClip(video.url, vPlan, vFile, signal),
      writeRepClip(audio.url, aPlan, aFile, signal),
    ]);
    const vStart = vPlan.clipStartTime;
    const aStart = aPlan.clipStartTime;
    reportProgress(80);

    // 4) 정밀 컷 + mux. 조립 파일은 clipStartTime부터 시작 → (start-clipStartTime) seek.
    const dur = endTime - startTime;
    const args = [
      '-y',
      '-ss', (startTime - vStart).toFixed(3), '-i', vFile,
      '-ss', (startTime - aStart).toFixed(3), '-i', aFile,
      '-map', '0:v:0', '-map', '1:a:0',
      '-t', String(dur),
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero', '-fflags', '+genpts', '-movflags', '+faststart',
      outputPath,
    ];
    const proc = spawn(getFfmpegPath(), args, { stdio: ['ignore', 'pipe', 'pipe'] });
    signal?.addEventListener('abort', () => { if (!proc.killed) proc.kill('SIGKILL'); }, { once: true });
    let stderr = '';
    proc.stderr?.on('data', (c: Buffer) => { stderr = (stderr + c.toString()).slice(-20_000); });
    const ok = await runWithTimeout(proc, PROCESS.FFMPEG_TIMEOUT_MS);
    if (!ok) throw new Error(`byte-range 컷(ffmpeg) 실패: ${stderr.split('\n').filter(Boolean).slice(-2).join(' ').slice(-300)}`);
    reportProgress(100);
    console.log(`[byte-range] clip OK: ${jobId} (${video.height}p)`);
  } finally {
    await fsPromises.unlink(vFile).catch(() => {});
    await fsPromises.unlink(aFile).catch(() => {});
  }
}
