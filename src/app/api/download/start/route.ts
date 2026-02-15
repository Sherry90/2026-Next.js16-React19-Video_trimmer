import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { startDownloadJob } from '@/lib/downloadJob';
import { validateDownloadRequest, handleApiError } from '@/utils/apiUtils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/download/start
 *
 * 다운로드 작업 시작
 * - JobID 생성
 * - 백그라운드에서 streamlink → ffmpeg 파이프라인 실행
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 파라미터 검증
    const validation = validateDownloadRequest(body);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const { url, startTime, endTime, filename, tbr } = validation.data;

    // JobID 생성
    const jobId = randomUUID();

    console.log('[SSE] ========== NEW DOWNLOAD STARTED ==========');
    console.log(`[SSE] Job: ${jobId}, URL: ${url}, Range: ${startTime}s-${endTime}s`);

    // 백그라운드에서 다운로드 작업 시작
    startDownloadJob(jobId, { url, startTime, endTime, filename, tbr }).catch((error) => {
      console.error(`[SSE] Job ${jobId} failed:`, error);
    });

    // JobID 즉시 반환
    return NextResponse.json({ jobId });
  } catch (error) {
    return handleApiError(error, 'download/start', '다운로드 시작에 실패했습니다');
  }
}
