import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { getJob, deleteJob } from '@/lib/downloadJob';
import { streamFile } from '@/lib/streamUtils';

/**
 * GET /api/download/[jobId]
 *
 * 완료된 파일 다운로드
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  try {
    const job = getJob(jobId);

    if (!job) {
      return NextResponse.json({ error: 'Job을 찾을 수 없습니다' }, { status: 404 });
    }

    if (job.status !== 'completed') {
      return NextResponse.json({ error: 'Job이 아직 완료되지 않았습니다' }, { status: 400 });
    }

    const { outputPath } = job;

    if (!outputPath || !existsSync(outputPath)) {
      return NextResponse.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 });
    }

    // Stream the output file directly to disk (Content-Disposition: attachment).
    // 스트림 종료 시 파일을 삭제하지 않는다 — 대용량 중단 재시도/재다운로드를 위해
    // 보존하고, 정리는 JOB_TTL_MS(lazy) + reset 시 DELETE에 위임한다.
    console.log('[download] Streaming file to client...');

    return streamFile({
      filePath: outputPath,
      contentType: 'video/mp4',
      contentDisposition: 'attachment',
      onStreamError: (err) => {
        console.error('[download] Stream error:', err);
      },
    });
  } catch (error: unknown) {
    console.error('[download] Error:', error);
    const message = error instanceof Error ? error.message : '다운로드 중 오류가 발생했습니다';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/download/[jobId]
 *
 * 완료 파일/잡 즉시 정리 (reset, 다른 영상 편집 시 호출).
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    deleteJob(jobId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[download] Delete error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
