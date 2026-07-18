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
  // 클라이언트 처리 계열
  | "MEMORY_INSUFFICIENT"
  | "CODEC_UNSUPPORTED"
  | "FILE_CORRUPTED"
  | "FFMPEG_LOAD_FAILED"
  | "PROCESSING_FAILED"
  // 서버/네트워크/다운로드 계열
  | "NETWORK_ERROR"
  | "DOWNLOAD_ERROR"
  | "VIDEO_UNAVAILABLE"
  | "BINARY_MISSING"
  | "TIMEOUT"
  | "VALIDATION_ERROR"
  | "EXPORT_ERROR"
  | "SERVER_ERROR"
  | "UNKNOWN";

/** 에러 발생 정황 — 리포트/디버깅에 쓰는 부가 정보 */
export interface ErrorContext {
  jobId?: string;
  stage?: string; // 실패 단계 (예: 'yt-dlp byte-range', 'ffmpeg cut')
  command?: string; // 실행 명령 (서버)
  exitCode?: number | null; // 프로세스 종료 코드
  timestamp?: string; // ISO 문자열
}

export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string; // 사용자 친화적 메시지
  solution?: string; // 해결 방법
  technicalDetails?: string; // 기술적 상세 정보 (stderr 등)
  context?: ErrorContext; // 정황 (jobId/stage/exitCode/timestamp)
}

export interface ErrorDisplayProps {
  error: AppError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

// ============================================================
// Timeline Types (from timeline.ts)
// ============================================================

export type HandleType = "inPoint" | "outPoint" | "playhead";

export interface TimelinePosition {
  x: number; // 픽셀 단위
  time: number; // 초 단위
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
  maxSize: number; // bytes
  supportedFormats: string[];
}
