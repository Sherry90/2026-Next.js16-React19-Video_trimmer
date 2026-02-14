import { NextResponse } from 'next/server';
import { createReadStream, statSync } from 'fs';

/**
 * 파일 스트리밍 옵션
 */
export interface StreamFileOptions {
  /** 스트리밍할 파일 경로 */
  filePath: string;
  /** Content-Type 헤더 값 */
  contentType: string;
  /** 스트림 종료 후 실행할 콜백 (cleanup 등) */
  onStreamEnd?: () => void | Promise<void>;
  /** 스트림 에러 발생 시 실행할 콜백 */
  onStreamError?: (error: Error) => void;
}

/**
 * 파일을 스트리밍하는 NextResponse 생성
 *
 * ReadableStream을 사용하여 파일을 클라이언트에 스트리밍합니다.
 * 스트림 종료 후 자동으로 cleanup 콜백을 실행합니다.
 *
 * @param options - 스트리밍 옵션
 * @returns NextResponse with streaming body
 *
 * @example
 * ```typescript
 * return streamFile({
 *   filePath: '/tmp/output.mp4',
 *   contentType: 'video/mp4',
 *   onStreamEnd: async () => {
 *     unlinkSync('/tmp/output.mp4');
 *   },
 * });
 * ```
 */
export function streamFile(options: StreamFileOptions): NextResponse {
  const { filePath, contentType, onStreamEnd, onStreamError } = options;

  const stat = statSync(filePath);
  const fileStream = createReadStream(filePath);

  const stream = new ReadableStream({
    start(controller) {
      fileStream.on('data', (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      fileStream.on('end', async () => {
        controller.close();
        try {
          await onStreamEnd?.();
        } catch (err) {
          console.error('[streamFile] Cleanup error:', err);
        }
      });

      fileStream.on('error', (err) => {
        controller.error(err);
        onStreamError?.(err);
      });
    },

    cancel() {
      fileStream.destroy();
      onStreamError?.(new Error('Stream cancelled'));
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(stat.size),
    },
  });
}
