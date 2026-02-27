/**
 * 다운로드 파이프라인 공유 타입 및 유틸리티
 *
 * streamlinkDownloader, ytdlpDownloader, downloadJob 에서 공통으로 사용하는
 * 타입 정의와 파일 유틸 함수를 한 곳으로 모아 중복을 제거한다.
 */

import { unlinkSync, existsSync, promises as fsPromises } from 'fs';
import type { SSEProgressEvent, SSECompleteEvent, SSEErrorEvent, DownloadPhase } from '@/types/sse';
import { clamp } from '@/utils/mathUtils';
import { DOWNLOAD } from '@/constants/appConfig';

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
  createdAt: number;
  abort?: () => void;
  orphanCleanupScheduled?: boolean;
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

      try {
        // 2. 파일 크기 확인
        const stats = await fd.stat();
        if (stats.size < DOWNLOAD.MIN_VALID_FILE_SIZE) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          continue;
        }

        // 3. MP4 ftyp header 읽기 (처음 12 bytes)
        const buffer = Buffer.allocUnsafe(12);
        await fd.read(buffer, 0, 12, 0);

        // 4. MP4 signature 검증
        // MP4 파일은 'ftyp' box로 시작 (offset 4-8)
        const signature = buffer.toString('ascii', 4, 8);
        if (signature === 'ftyp') {
          // 파일이 완전히 쓰여짐
          return;
        }

        // 5. signature 불완전 → 재시도
        await new Promise((resolve) => setTimeout(resolve, 50));
      } finally {
        await fd.close().catch(() => {});
      }
    } catch (error) {
      // 파일 아직 쓰기 중 또는 잠김 → 재시도
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  throw new Error(`File completion timeout: ${filePath}`);
}

/**
 * 다운로드 진행률 추적기
 *
 * streamlinkDownloader, ytdlpDownloader 공통 진행률 계산/전송 로직
 */
export class DownloadProgressTracker {
  private processedSeconds = 0;
  private lastEmittedProgress = -1;
  private lastEmittedPhase: DownloadPhase | null = null;
  private totalSeconds: number;
  private currentPhase: DownloadPhase;

  constructor(
    private jobId: string,
    private emitEvent: EventEmitter,
    private segmentDuration: number,
    initialPhase: DownloadPhase,
  ) {
    this.totalSeconds = Math.max(1, segmentDuration);
    this.currentPhase = initialPhase;
  }

  private computeProgress(): number {
    return clamp((this.processedSeconds / this.totalSeconds) * 100, 0, 100);
  }

  emitProgress(phase: DownloadPhase, force = false): void {
    const roundedProgress = Math.round(this.computeProgress());

    if (!force && roundedProgress === this.lastEmittedProgress && phase === this.lastEmittedPhase) {
      return;
    }

    this.emitEvent(this.jobId, {
      type: 'progress',
      jobId: this.jobId,
      progress: roundedProgress,
      processedSeconds: Number(this.processedSeconds.toFixed(2)),
      totalSeconds: Number(this.totalSeconds.toFixed(2)),
      phase,
    });

    this.lastEmittedProgress = roundedProgress;
    this.lastEmittedPhase = phase;
  }

  updateProgress(progressPercent: number, expectedPhase: DownloadPhase): void {
    if (this.currentPhase !== expectedPhase) return;
    const normalized = clamp(progressPercent, 0, 100);
    const seconds = (this.segmentDuration * normalized) / 100;
    if (seconds > this.processedSeconds || expectedPhase === 'downloading') {
      this.processedSeconds = expectedPhase === 'downloading'
        ? seconds
        : Math.max(this.processedSeconds, seconds);
      this.emitProgress(expectedPhase);
    }
  }

  resetForPhase(phase: DownloadPhase): void {
    this.processedSeconds = 0;
    this.totalSeconds = Math.max(1, this.segmentDuration);
    this.currentPhase = phase;
  }

  setCurrentPhase(phase: DownloadPhase): void {
    this.currentPhase = phase;
  }

  getCurrentPhase(): DownloadPhase {
    return this.currentPhase;
  }

  emitComplete(filename: string): void {
    this.emitEvent(this.jobId, {
      type: 'complete',
      jobId: this.jobId,
      filename,
    });
  }

  emitError(message: string): void {
    this.emitEvent(this.jobId, {
      type: 'error',
      jobId: this.jobId,
      message,
    });
  }
}
