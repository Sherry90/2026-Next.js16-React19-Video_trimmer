/**
 * 공통 타입 정의
 * - 에러 타입
 * - 타임라인 타입
 * - 비디오 파일 타입
 */

// ============================================================
// Error Types (from error.ts)
// ============================================================

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

// ============================================================
// Timeline Types (from timeline.ts)
// ============================================================

export type HandleType = 'inPoint' | 'outPoint' | 'playhead';

export interface TimelinePosition {
  x: number;        // 픽셀 단위
  time: number;     // 초 단위
}

export interface DragState {
  isDragging: boolean;
  handleType: HandleType | null;
  startX: number;
  startTime: number;
}

// ============================================================
// Video Types (from video.ts)
// ============================================================

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  frameRate: number;
  codec: string;
}

export interface VideoConstraints {
  maxSize: number;      // bytes
  supportedFormats: string[];
}
