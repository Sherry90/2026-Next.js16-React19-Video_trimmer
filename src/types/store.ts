export type AppPhase =
  | 'idle'           // 초기 상태
  | 'uploading'      // 파일 업로드 중
  | 'url_preview'    // URL 메타데이터 미리보기 + 구간 설정
  | 'editing'        // 편집 중
  | 'processing'     // 트리밍 처리 중
  | 'completed'      // 완료
  | 'error';         // 에러 발생

export interface UrlPreviewState {
  title: string;
  duration: number;
  thumbnail: string;
  originalUrl: string;
  streamUrl: string;
  streamType: 'hls' | 'mp4';
  inPoint: number;
  outPoint: number;
  tbr: number | null; // Total bitrate (kbps)
}

export interface VideoFile {
  file: File | null;       // null for URL sources
  source: 'file' | 'url'; // 입력 소스 구분
  name: string;
  size: number;            // URL 소스는 0 가능
  type: string;
  url: string;             // Object URL 또는 프록시 URL
  duration: number;        // 초 단위
  // URL 소스 전용 필드
  streamUrl?: string;      // yt-dlp가 추출한 실제 스트림 URL
  streamType?: 'hls' | 'mp4'; // 스트림 형식
  thumbnail?: string;      // 영상 썸네일 URL
  originalUrl?: string;    // 사용자가 입력한 원본 URL
}

export interface TimelineState {
  inPoint: number;       // 초 단위
  outPoint: number;      // 초 단위
  playhead: number;      // 초 단위
  isInPointLocked: boolean;   // Phase 4
  isOutPointLocked: boolean;  // Phase 4
  zoom: number;          // Phase 4 (1 = 100%)
}

export interface ProcessingState {
  uploadProgress: number;     // 0-100
  trimProgress: number;       // 0-100
  waveformProgress: number;   // Phase 4, 0-100
  downloadPhase: 'downloading' | 'processing' | 'completed' | null; // Socket.IO download phase
  downloadMessage: string | null;   // Socket.IO download message
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
}

export interface ExportState {
  outputUrl: string | null;   // Blob URL
  outputFilename: string | null;
}
