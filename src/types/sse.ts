/**
 * SSE (Server-Sent Events) 타입 정의
 */

/**
 * 다운로드 단계 타입
 */
export type DownloadPhase = 'downloading' | 'processing' | 'completed';

/**
 * SSE 진행 상태 이벤트
 */
export interface SSEProgressEvent {
  type: 'progress';
  phase: DownloadPhase;
  progress: number; // 0-100
  processedSeconds?: number;
  totalSeconds?: number;
}

/**
 * SSE 완료 이벤트
 */
export interface SSECompleteEvent {
  type: 'complete';
}

/**
 * SSE 에러 이벤트
 */
export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

/**
 * SSE 이벤트 타입 (Discriminated Union)
 */
export type SSEEvent = SSEProgressEvent | SSECompleteEvent | SSEErrorEvent;

/**
 * 다운로드 요청 파라미터
 */
export interface DownloadRequest {
  url: string;
  startTime: number;
  endTime: number;
  filename: string;
  tbr?: number | null;
}

/**
 * 다운로드 Job 응답
 */
export interface DownloadJobResponse {
  jobId: string;
}
