import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, unlinkSync, statSync, existsSync } from 'fs';
import { getJob, deleteJob } from '@/lib/downloadJob';

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

    // Stream the output file
    const stat = statSync(outputPath);
    const fileStream = createReadStream(outputPath);

    console.log(`[download] Streaming file: ${stat.size} bytes (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        fileStream.on('end', () => {
          controller.close();
          // Cleanup after download
          try {
            deleteJob(jobId);
          } catch (error) {
            console.error('[download] Cleanup error:', error);
          }
        });
        fileStream.on('error', (err) => {
          controller.error(err);
          try {
            deleteJob(jobId);
          } catch {
            /* ignore */
          }
        });
      },
      cancel() {
        fileStream.destroy();
        try {
          deleteJob(jobId);
        } catch {
          /* ignore */
        }
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(stat.size),
      },
    });
  } catch (error: unknown) {
    console.error('[download] Error:', error);
    const message = error instanceof Error ? error.message : '다운로드 중 오류가 발생했습니다';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
