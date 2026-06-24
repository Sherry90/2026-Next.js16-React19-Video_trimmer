/**
 * SSE (Server-Sent Events) 타입 정의
 */

import type { ErrorCode } from '@/types/types';

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
  message: string; // 사용자 친화적 메시지
  code?: ErrorCode; // 분류 코드
  technicalDetails?: string; // 기술적 원인 (stderr 등, 접이식 노출용)
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
  /** 최대 화질 height(px) — 플레이어에서 선택한 화질과 일치 */
  maxHeight?: number | null;
}

/**
 * 다운로드 Job 응답
 */
export interface DownloadJobResponse {
  jobId: string;
}
