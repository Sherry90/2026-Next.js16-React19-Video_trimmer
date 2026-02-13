import { NextRequest } from 'next/server';
import { getJobStream } from '@/lib/downloadJob';

export const dynamic = 'force-dynamic';

/**
 * GET /api/download/stream/[jobId]
 *
 * Server-Sent Events (SSE) endpoint
 * - 다운로드 진행 상황을 실시간 스트리밍
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  console.log(`[SSE] Client connected to stream: ${jobId}`);

  // ReadableStream 생성
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // JobStream 구독
      const unsubscribe = getJobStream(jobId, (event) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));

          // 완료/에러 시 스트림 종료
          if (event.type === 'complete' || event.type === 'error') {
            console.log(`[SSE] Stream closed: ${jobId} (${event.type})`);
            controller.close();
            unsubscribe();
          }
        } catch (err) {
          console.error(`[SSE] Stream error: ${jobId}`, err);
          controller.error(err);
          unsubscribe();
        }
      });

      // 클라이언트 연결 끊김 처리
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Client disconnected: ${jobId}`);
        controller.close();
        unsubscribe();
      });
    },
  });

  // SSE 헤더와 함께 응답
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx 버퍼링 비활성화
    },
  });
}
