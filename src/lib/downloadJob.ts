/**
 * 다운로드 작업 오케스트레이터
 *
 * 플랫폼 감지 후 적절한 다운로드 전략 선택:
 * - Chzzk → Streamlink
 * - YouTube/기타 → yt-dlp (향후 구현)
 */

import { detectPlatform, selectDownloadStrategy } from './platformDetector';
import { downloadWithStreamlink } from './streamlinkDownloader';
import { downloadWithYtdlp } from './ytdlpDownloader';
import { type Job, type JobListener, type EventEmitter, type JobEvent, safeUnlink } from './downloadTypes';
import { DOWNLOAD } from '@/constants/appConfig';

// Global job storage (향후 Redis/DB로 교체 가능)
// globalThis에 저장 → 커스텀 서버(server.ts, Next 우회 raw SSE)가 같은 레지스트리를 본다.
// (Next 라우트와 server.ts는 모듈 레지스트리가 분리돼 있어도 globalThis는 동일 V8 전역이라 공유됨)
const jobs: Map<string, Job> =
  ((globalThis as unknown as { __vtDownloadJobs?: Map<string, Job> }).__vtDownloadJobs ??= new Map<string, Job>());

/**
 * Job 스트림 구독
 */
export function getJobStream(jobId: string, listener: JobListener): () => void {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  job.listeners.push(listener);

  return () => {
    const currentJob = jobs.get(jobId);
    if (!currentJob) return;

    currentJob.listeners = currentJob.listeners.filter((l) => l !== listener);

    // 마지막 리스너 이탈 + 잡 실행 중 → grace period 후 abort
    // orphanCleanupScheduled 플래그로 중복 setTimeout 방지
    if (currentJob.listeners.length === 0 && currentJob.status === 'running' && !currentJob.orphanCleanupScheduled) {
      currentJob.orphanCleanupScheduled = true;
      setTimeout(() => {
        const job = jobs.get(jobId);
        if (job && job.status === 'running' && job.listeners.length === 0) {
          console.log(`[SSE] Cancelling orphaned job: ${jobId}`);
          job.abort?.();
        }
      }, DOWNLOAD.JOB_ORPHAN_GRACE_PERIOD_MS);
    }
  };
}

/**
 * 오래된 완료/실패 잡 정리 (lazy, startDownloadJob 호출 시 실행)
 */
function cleanupStaleJobs(): void {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (
      (job.status === 'completed' || job.status === 'failed') &&
      now - job.createdAt > DOWNLOAD.JOB_TTL_MS
    ) {
      deleteJob(jobId);
    }
  }
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
  if (updates.errorMessage !== undefined) job.errorMessage = updates.errorMessage;

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
    maxHeight?: number; // 최대 화질 height(px) — 플레이어 선택 화질과 일치
  }
) {
  cleanupStaleJobs();

  const { url, startTime, endTime, filename, tbr, streamType, maxHeight } = params;

  const abortController = new AbortController();

  // Job 등록 (리스너 보존)
  const existingJob = jobs.get(jobId);
  if (!existingJob) {
    // 첫 실행: 새 Job 생성
    jobs.set(jobId, {
      outputPath: null,
      status: 'running',
      listeners: [],
      createdAt: Date.now(),
      abort: () => abortController.abort(),
    });
  } else {
    existingJob.status = 'running';
    existingJob.outputPath = null;
    existingJob.createdAt = Date.now();
    existingJob.abort = () => abortController.abort();
  }

  const platform = detectPlatform(url);
  const strategy = selectDownloadStrategy(platform, streamType || 'mp4');

  // wall 안전 타임아웃: 잡이 MAX_JOB_MS를 넘기면 강제 abort → 다운로더의 abort 리스너가
  // 자식 프로세스 트리(yt-dlp+aria2c 등)까지 정리. 런어웨이로 서버가 죽는 걸 방지하는 백스톱.
  const wallTimer = setTimeout(() => {
    const job = jobs.get(jobId);
    if (job && job.status === 'running') {
      console.error(`[SSE] Job ${jobId} exceeded MAX_JOB_MS(${DOWNLOAD.MAX_JOB_MS}ms) → aborting`);
      abortController.abort();
    }
  }, DOWNLOAD.MAX_JOB_MS);

  // 전략별 다운로더에 위임
  const runner =
    strategy === 'streamlink'
      ? downloadWithStreamlink(
          jobId,
          { url, startTime, endTime, filename, tbr, maxHeight },
          emitEvent,
          updateJobStatus,
          abortController.signal
        )
      : downloadWithYtdlp(
          jobId,
          { url, startTime, endTime, filename, tbr, maxHeight },
          emitEvent,
          updateJobStatus,
          abortController.signal
        );

  // 완료/실패/abort 어느 경로로 끝나든 wall 타이머 해제 (타이머 누수 방지)
  return runner.finally(() => clearTimeout(wallTimer));
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
