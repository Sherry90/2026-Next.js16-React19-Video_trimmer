/**
 * Server-side video trimming for URL sources
 * Calls /api/video/trim and streams the result
 */

interface TrimVideoServerOptions {
  originalUrl: string;
  startTime: number;
  endTime: number;
  filename: string;
  onProgress?: (progress: number) => void;
  /** Called when the first byte of the response body is received */
  onResponseStart?: () => void;
}

export async function trimVideoServer(options: TrimVideoServerOptions): Promise<Blob> {
  const { originalUrl, startTime, endTime, filename, onProgress, onResponseStart } = options;

  console.log('[trimVideoServer] Starting fetch to /api/video/trim');
  onProgress?.(0);

  const response = await fetch('/api/video/trim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl, startTime, endTime, filename }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Server trim failed: ${response.status}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  // Read the stream and track progress
  const contentLength = response.headers.get('content-length');
  const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

  const reader = response.body.getReader();
  const chunks: BlobPart[] = [];
  let receivedBytes = 0;
  let isFirstChunk = true;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (isFirstChunk) {
      onResponseStart?.();
      isFirstChunk = false;
    }

    chunks.push(value);
    receivedBytes += value.length;

    if (totalBytes > 0) {
      onProgress?.(Math.round((receivedBytes / totalBytes) * 100));
    } else {
      // Without content-length, show indeterminate progress
      // Cap at 90% until complete
      onProgress?.(Math.min(90, Math.round(receivedBytes / 1024 / 1024)));
    }
  }

  onProgress?.(100);

  const blob = new Blob(chunks, { type: 'video/mp4' });
  console.log(`[trimVideoServer] Received blob: ${blob.size} bytes (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);

  return blob;
}
