import type { DownloadPhase } from "./sse";

export type AppPhase =
  | "idle" // 초기 상태
  | "uploading" // 파일 업로드 중
  | "editing" // 편집 중 (파일/URL 스트리밍 공통)
  | "processing" // 트리밍 처리 중
  | "completed" // 완료
  | "error"; // 에러 발생

export interface VideoFile {
  file: File | null; // null for URL sources
  source: "file" | "url"; // 입력 소스 구분
  name: string;
  size: number; // URL 소스는 0 가능
  type: string;
  url: string; // Object URL 또는 프록시 URL
  duration: number; // 초 단위
  // URL 소스 전용 필드
  streamUrl?: string; // yt-dlp가 추출한 실제 스트림 URL
  streamType?: "hls" | "mp4" | "dash"; // 스트림 형식
  thumbnail?: string; // 영상 썸네일 URL
  originalUrl?: string; // 사용자가 입력한 원본 URL
  tbr?: number | null; // Total bitrate (kbps) — 다운로드 품질 힌트
  qualities?: { height: number }[]; // DASH 화질 목록 (높→낮)
}

export interface TimelineState {
  inPoint: number; // 초 단위
  outPoint: number; // 초 단위
  playhead: number; // 초 단위
  isInPointLocked: boolean; // Phase 4
  isOutPointLocked: boolean; // Phase 4
  zoom: number; // Phase 4 (1 = 100%)
  waveformDisplayMode: WaveformDisplayMode;
  draggingBoundary: "in" | "out" | null; // 트림 핸들 드래그 중인 경계(playhead 추종용)
}

export type WaveformDisplayMode = "waveform" | "spectrogram";

export interface ProcessingState {
  uploadProgress: number; // 0-100
  trimProgress: number; // 0-100
  waveformProgress: number; // Phase 4, 0-100
  downloadPhase: DownloadPhase | null; // SSE download phase
  downloadMessage: string | null; // SSE download message
  activeDownloadJobId: string | null; // HMR 재연결을 위한 활성 job ID
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  isScrubbing: boolean;
}

export interface ErrorState {
  hasError: boolean;
  errorMessage: string | null;
  errorCode: string | null;
  technicalDetails: string | null; // 기술적 원인 (stderr 등, 접이식 노출용)
}

export interface ExportState {
  outputUrl: string | null; // Blob URL
  outputFilename: string | null;
}
