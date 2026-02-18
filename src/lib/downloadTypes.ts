/**
 * 다운로드 파이프라인 공유 타입 및 유틸리티
 *
 * streamlinkDownloader, ytdlpDownloader, downloadJob 에서 공통으로 사용하는
 * 타입 정의와 파일 유틸 함수를 한 곳으로 모아 중복을 제거한다.
 */

import { unlinkSync, existsSync, promises as fsPromises } from 'fs';
import type { SSEProgressEvent, SSECompleteEvent, SSEErrorEvent } from '@/types/sse';

// Server-side event types (extends SSE types with jobId)
export type JobProgressEvent = SSEProgressEvent & { jobId: string; processedSeconds: number; totalSeconds: number };
export type JobCompleteEvent = SSECompleteEvent & { jobId: string; filename: string };
export type JobErrorEvent = SSEErrorEvent & { jobId: string };
export type JobEvent = JobProgressEvent | JobCompleteEvent | JobErrorEvent;

export type JobListener = (event: JobEvent) => void;

export type Job = {
  outputPath: string | null;
  status: 'running' | 'completed' | 'failed';
  listeners: JobListener[];
  errorMessage?: string;
};

// Event emitter function type
export type EventEmitter = (jobId: string, event: JobEvent) => void;

/**
 * 파일 안전 삭제 (존재하지 않거나 실패해도 무시)
 */
export function safeUnlink(path: string): void {
  try {
    if (path && existsSync(path)) unlinkSync(path);
  } catch {}
}

/**
 * MP4 파일의 버퍼 플러시 완료 및 메타데이터 유효성 검증
 *
 * FFmpeg 프로세스 종료 후 OS 커널 버퍼가 디스크에 완전히 쓰여질 때까지 대기
 */
export async function ensureFileComplete(filePath: string, timeoutMs = 5000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      // 1. 파일 열기 시도 (read-only)
      const fd = await fsPromises.open(filePath, 'r');

      // 2. 파일 크기 확인
      const stats = await fd.stat();
      if (stats.size < 1024) {
        await fd.close();
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }

      // 3. MP4 ftyp header 읽기 (처음 12 bytes)
      const buffer = Buffer.allocUnsafe(12);
      await fd.read(buffer, 0, 12, 0);
      await fd.close();

      // 4. MP4 signature 검증
      // MP4 파일은 'ftyp' box로 시작 (offset 4-8)
      const signature = buffer.toString('ascii', 4, 8);
      if (signature === 'ftyp') {
        // 파일이 완전히 쓰여짐
        return;
      }

      // 5. signature 불완전 → 재시도
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error) {
      // 파일 아직 쓰기 중 또는 잠김 → 재시도
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw new Error(`File completion timeout: ${filePath}`);
}
