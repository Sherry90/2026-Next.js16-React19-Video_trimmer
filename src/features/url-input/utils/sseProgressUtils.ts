import type { SSEProgressEvent } from '@/types/sse';

/**
 * Phase별 가중치 상수
 */
export const PHASE_WEIGHTS = {
  DOWNLOADING: 0.9, // 0-90%
  PROCESSING: 0.1, // 90-100%
} as const;

/**
 * Phase별 전체 진행률 계산
 *
 * @param phase - 현재 Phase
 * @param progress - Phase 내 진행률 (0-100)
 * @returns 전체 진행률 (0-100)
 */
export function calculateOverallProgress(
  phase: SSEProgressEvent['phase'],
  progress: number
): number {
  if (phase === 'downloading') {
    // downloading: 0-90%로 매핑
    return Math.round(progress * PHASE_WEIGHTS.DOWNLOADING);
  } else if (phase === 'processing') {
    // processing: 90-100%로 매핑
    return Math.round(90 + progress * PHASE_WEIGHTS.PROCESSING);
  } else {
    // completed
    return 100;
  }
}

/**
 * Phase별 메시지 생성
 *
 * @param phase - 현재 Phase
 * @param processedSeconds - 처리된 시간 (초)
 * @param totalSeconds - 전체 시간 (초)
 * @returns Phase에 맞는 메시지
 */
export function getPhaseMessage(
  phase: SSEProgressEvent['phase'],
  processedSeconds?: number,
  totalSeconds?: number
): string {
  switch (phase) {
    case 'downloading':
      return `다운로드 중 (${Math.round(processedSeconds ?? 0)}/${Math.round(
        totalSeconds ?? 0
      )}s)`;
    case 'processing':
      return 'FFmpeg로 타임스탬프 리셋 중...';
    case 'completed':
      return '완료!';
    default:
      return '처리 중...';
  }
}
