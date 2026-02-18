import { NextRequest } from 'next/server';
import { getJob, getJobStream } from '@/lib/downloadJob';

export const dynamic = 'force-dynamic';

/**
 * GET /api/download/stream/[jobId]
 *
 * Server-Sent Events (SSE) endpoint
 * - 다운로드 진행 상황을 실시간 스트리밍
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  // console.log(`[SSE] ========== SSE STREAM REQUEST ==========`);
  // console.log(`[SSE] 🔌 Client connected to stream: ${jobId}`);
  // console.log(`[SSE] 🔌 Request URL: ${request.url}`);

  // ReadableStream 생성
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const encode = (event: object) => encoder.encode(`data: ${JSON.stringify(event)}\n\n`);

      // [재연결 처리] 현재 job 상태 즉시 확인
      const currentJob = getJob(jobId);

      if (!currentJob) {
        controller.enqueue(encode({ type: 'error', message: '다운로드 정보가 만료되었습니다' }));
        controller.close();
        return;
      }

      if (currentJob.status === 'completed') {
        controller.enqueue(encode({ type: 'complete' }));
        controller.close();
        return;
      }

      if (currentJob.status === 'failed') {
        controller.enqueue(encode({ type: 'error', message: currentJob.errorMessage ?? '다운로드에 실패했습니다' }));
        controller.close();
        return;
      }

      // status === 'running' → 기존 로직대로 listeners에 등록
      // 즉시 초기 이벤트 전송 (Next.js 버퍼링 방지)
      controller.enqueue(encoder.encode(': connected\n\n'));

      // JobStream 구독
      const unsubscribe = getJobStream(jobId, (event) => {
        try {
          controller.enqueue(encode(event));

          // 완료/에러 시 스트림 종료
          if (event.type === 'complete' || event.type === 'error') {
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
        // console.log(`[SSE] Client disconnected: ${jobId}`);
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
