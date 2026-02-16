/**
 * 다운로드 작업 오케스트레이터
 *
 * 플랫폼 감지 후 적절한 다운로드 전략 선택:
 * - Chzzk → Streamlink
 * - YouTube/기타 → yt-dlp (향후 구현)
 */

import { unlinkSync, existsSync } from 'fs';
import { detectPlatform, selectDownloadStrategy } from './platformDetector';
import {
  downloadWithStreamlink,
  type JobListener,
  type Job,
  type EventEmitter,
} from './streamlinkDownloader';
import { downloadWithYtdlp } from './ytdlpDownloader';

function safeUnlink(path: string): void {
  try {
    if (path && existsSync(path)) unlinkSync(path);
  } catch {}
}

// Server-side event types (extends SSE types with jobId)
import type { SSEProgressEvent, SSECompleteEvent, SSEErrorEvent } from '@/types/sse';

type JobProgressEvent = SSEProgressEvent & { jobId: string; processedSeconds: number; totalSeconds: number };
type JobCompleteEvent = SSECompleteEvent & { jobId: string; filename: string };
type JobErrorEvent = SSEErrorEvent & { jobId: string };
type JobEvent = JobProgressEvent | JobCompleteEvent | JobErrorEvent;

// Global job storage (향후 Redis/DB로 교체 가능)
const jobs = new Map<string, Job>();

/**
 * Job 스트림 구독
 */
export function getJobStream(jobId: string, listener: JobListener): () => void {
  let job = jobs.get(jobId);

  if (!job) {
    // Job이 없으면 새로 생성 (리스너만 등록)
    job = {
      outputPath: null,
      status: 'running',
      listeners: [listener],
    };
    jobs.set(jobId, job);
    console.log(`[SSE] 🔌 Job created with initial listener: ${jobId}`);
  } else {
    // 기존 Job에 리스너 추가
    job.listeners.push(listener);
    console.log(`[SSE] 🔌 Listener added to existing job: ${jobId} (total: ${job.listeners.length})`);
  }

  // Unsubscribe 함수 반환
  return () => {
    const currentJob = jobs.get(jobId);
    if (currentJob) {
      const beforeCount = currentJob.listeners.length;
      currentJob.listeners = currentJob.listeners.filter((l) => l !== listener);
      console.log(`[SSE] 🔌 Listener removed from job: ${jobId} (${beforeCount} → ${currentJob.listeners.length})`);
    }
  };
}

/**
 * 모든 리스너에게 이벤트 전송
 */
function emitEvent(jobId: string, event: JobEvent) {
  const job = jobs.get(jobId);

  // Case 1: Job not found (critical error)
  if (!job) {
    console.error(`[SSE] ❌ Event dropped: job not found (${jobId}), event type: ${event.type}`);
    return;
  }

  // Case 2: No listeners (warning - indicates race condition)
  if (job.listeners.length === 0) {
    console.warn(`[SSE] ⚠️  No listeners for job ${jobId}, event type: ${event.type} (possible race condition)`);
  }

  // Log emission (helps verify listeners are working)
  console.log(`[SSE] 📡 Emitting ${event.type} to ${job.listeners.length} listener(s) for job ${jobId}`);

  // Emit to all listeners
  job.listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error(`[SSE] Listener error for job ${jobId}:`, err);
    }
  });
}

/**
 * Job 상태 업데이트
 */
function updateJobStatus(jobId: string, updates: Partial<Job>) {
  const job = jobs.get(jobId);
  if (!job) {
    console.error(`[SSE] ❌ Cannot update job status: job not found (${jobId})`);
    return;
  }

  // 기존 객체의 속성만 변경 (리스너 배열 참조 유지)
  if (updates.status !== undefined) job.status = updates.status;
  if (updates.outputPath !== undefined) job.outputPath = updates.outputPath;

  console.log(`[SSE] 🔧 Job status updated: ${jobId}, new status: ${job.status}`);
}

/**
 * 다운로드 작업 시작 (백그라운드)
 */
export async function startDownloadJob(
  jobId: string,
  params: {
    url: string;
    startTime: number;
    endTime: number;
    filename?: string;
    tbr?: number;
    streamType?: 'hls' | 'mp4'; // 플랫폼 힌트 (선택적)
  }
) {
  const { url, startTime, endTime, filename, tbr, streamType } = params;

  // Job 등록 (리스너 보존)
  const existingJob = jobs.get(jobId);
  if (!existingJob) {
    // 첫 실행: 새 Job 생성
    jobs.set(jobId, {
      outputPath: null,
      status: 'running',
      listeners: [],
    });
    console.log(`[SSE] 🔧 Job initialized: ${jobId}`);
  } else {
    // Job 존재: 리스너 보존하고 상태만 업데이트
    existingJob.status = 'running';
    existingJob.outputPath = null;
    console.log(`[SSE] 🔧 Job reinitialized: ${jobId} (preserving ${existingJob.listeners.length} listeners)`);
  }

  // 플랫폼 감지 및 전략 선택
  const platform = detectPlatform(url);
  const strategy = selectDownloadStrategy(platform, streamType || 'mp4');

  console.log(`[SSE] Platform: ${platform}, Strategy: ${strategy}`);

  // 전략별 다운로더에 위임
  if (strategy === 'streamlink') {
    return downloadWithStreamlink(
      jobId,
      { url, startTime, endTime, filename, tbr },
      emitEvent,
      updateJobStatus
    );
  } else {
    // yt-dlp 다운로더 (유튜브 및 범용 플랫폼)
    return downloadWithYtdlp(
      jobId,
      { url, startTime, endTime, filename, tbr },
      emitEvent,
      updateJobStatus
    );
  }
}

/**
 * Job 정보 조회
 */
export function getJob(jobId: string) {
  return jobs.get(jobId);
}

/**
 * Job 삭제
 */
export function deleteJob(jobId: string) {
  const job = jobs.get(jobId);
  if (job?.outputPath) {
    safeUnlink(job.outputPath);
  }
  jobs.delete(jobId);
}
