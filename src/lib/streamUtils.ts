import { NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";

/**
 * 파일 스트리밍 옵션
 */
export interface StreamFileOptions {
  /** 스트리밍할 파일 경로 */
  filePath: string;
  /** Content-Type 헤더 값 */
  contentType: string;
  /** Content-Disposition 헤더 값 (예: 'attachment') — 지정 시 브라우저가 디스크로 다운로드 */
  contentDisposition?: string;
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
  const { filePath, contentType, contentDisposition, onStreamEnd, onStreamError } = options;

  const stat = statSync(filePath);
  const fileStream = createReadStream(filePath);

  const stream = new ReadableStream({
    start(controller) {
      // 백프레셔 필수: 'data'에서 무조건 enqueue하면 디스크 read가 네트워크 전송보다
      // 빨라 controller 큐에 파일 전체가 쌓여 힙 OOM(대용량 구간 다운로드 시 GB+)이 난다.
      // desiredSize<=0 이면 disk read를 pause하고, 소비자가 당기면 pull()에서 resume.
      fileStream.on("data", (chunk: string | Buffer) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf));
        if (controller.desiredSize !== null && controller.desiredSize <= 0) {
          fileStream.pause();
        }
      });

      fileStream.on("end", async () => {
        controller.close();
        try {
          await onStreamEnd?.();
        } catch (err) {
          console.error("[streamFile] Cleanup error:", err);
        }
      });

      fileStream.on("error", (err) => {
        controller.error(err);
        onStreamError?.(err);
      });
    },

    pull() {
      fileStream.resume();
    },

    cancel() {
      fileStream.destroy();
      onStreamError?.(new Error("Stream cancelled"));
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(stat.size),
  };
  if (contentDisposition) {
    headers["Content-Disposition"] = contentDisposition;
  }

  return new NextResponse(stream, {
    status: 200,
    headers,
  });
}
