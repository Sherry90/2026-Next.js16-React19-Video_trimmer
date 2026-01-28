/**
 * Application Error Types and Interfaces
 */

export type ErrorCode =
  | 'MEMORY_INSUFFICIENT'
  | 'CODEC_UNSUPPORTED'
  | 'FILE_CORRUPTED'
  | 'FFMPEG_LOAD_FAILED'
  | 'PROCESSING_FAILED'
  | 'UNKNOWN';

export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string; // 사용자 친화적 메시지
  solution?: string; // 해결 방법
  technicalDetails?: string; // 기술적 상세 정보
}

export interface ErrorDisplayProps {
  error: AppError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}
