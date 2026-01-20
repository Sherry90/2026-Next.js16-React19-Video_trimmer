export type AppPhase =
  | 'idle'           // 초기 상태
  | 'uploading'      // 파일 업로드 중
  | 'loading-ffmpeg' // FFmpeg 로딩 중
  | 'ready'          // 편집 준비 완료
  | 'editing'        // 편집 중
  | 'processing'     // 트리밍 처리 중
  | 'completed'      // 완료
  | 'error';         // 에러 발생

export interface VideoFile {
  file: File;
  name: string;
  size: number;
  type: string;
  url: string;           // Object URL
  duration: number;      // 초 단위
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
  ffmpegLoadProgress: number; // 0-100
  trimProgress: number;       // 0-100
  waveformProgress: number;   // Phase 4, 0-100
}

export interface PlayerState {
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  isMuted: boolean;
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
