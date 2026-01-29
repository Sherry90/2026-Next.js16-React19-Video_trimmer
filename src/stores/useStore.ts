import { create } from 'zustand';
import type {
  AppPhase,
  VideoFile,
  TimelineState,
  ProcessingState,
  PlayerState,
  ErrorState,
  ExportState,
} from '@/types/store';
import { cleanupFFmpeg } from '@/features/export/utils/trimVideoDispatcher';

// ==================== 스토어 상태 ====================

interface StoreState {
  // 앱 단계
  phase: AppPhase;

  // 비디오 파일
  videoFile: VideoFile | null;

  // 타임라인
  timeline: TimelineState;

  // 처리 진행률
  processing: ProcessingState;

  // 플레이어 상태
  player: PlayerState;

  // 에러 상태
  error: ErrorState;

  // 내보내기 결과
  export: ExportState;
}

// ==================== 스토어 액션 ====================

interface StoreActions {
  // Phase 변경
  setPhase: (phase: AppPhase) => void;

  // 파일 관련
  setVideoFile: (file: VideoFile | null) => void;
  setVideoDuration: (duration: number) => void;

  // 타임라인 관련
  setInPoint: (time: number) => void;
  setOutPoint: (time: number) => void;
  setPlayhead: (time: number) => void;
  setInPointLocked: (locked: boolean) => void;
  setOutPointLocked: (locked: boolean) => void;
  setZoom: (zoom: number) => void;
  resetTimeline: () => void;

  // 진행률 관련
  setUploadProgress: (progress: number) => void;
  setTrimProgress: (progress: number) => void;
  setWaveformProgress: (progress: number) => void;

  // 플레이어 관련
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setIsScrubbing: (scrubbing: boolean) => void;

  // 에러 관련
  setError: (message: string, code?: string) => void;
  clearError: () => void;

  // 내보내기 관련
  setExportResult: (url: string, filename: string) => void;
  clearExportResult: () => void;

  // 전체 리셋
  reset: () => void;

  // 복합 액션 (상태 + 페이즈 전환)
  setErrorAndTransition: (message: string, code?: string) => void;
  setExportResultAndComplete: (url: string, filename: string) => void;
}

// ==================== 초기 상태 ====================

const initialState: StoreState = {
  phase: 'idle',
  videoFile: null,
  timeline: {
    inPoint: 0,
    outPoint: 0,
    playhead: 0,
    isInPointLocked: false,
    isOutPointLocked: false,
    zoom: 1,
  },
  processing: {
    uploadProgress: 0,
    trimProgress: 0,
    waveformProgress: 0,
  },
  player: {
    isPlaying: false,
    currentTime: 0,
    volume: 1,
    isMuted: false,
    isScrubbing: false,
  },
  error: {
    hasError: false,
    errorMessage: null,
    errorCode: null,
  },
  export: {
    outputUrl: null,
    outputFilename: null,
  },
};

// ==================== 스토어 생성 ====================

export const useStore = create<StoreState & StoreActions>()((set, get) => ({
  ...initialState,

  // Phase 변경
  setPhase: (phase) => set({ phase }),

  // 파일 관련
  setVideoFile: (videoFile) => set({ videoFile }),
  setVideoDuration: (duration) => {
    const { videoFile } = get();
    if (videoFile) {
      set({
        videoFile: { ...videoFile, duration },
        timeline: {
          ...get().timeline,
          outPoint: duration,
        },
      });
    }
  },

  // 타임라인 관련
  setInPoint: (time) => {
    const { timeline } = get();
    if (timeline.isInPointLocked) return;
    const constrainedTime = Math.max(0, Math.min(time, timeline.outPoint));
    set({
      timeline: {
        ...timeline,
        inPoint: constrainedTime,
        playhead: Math.max(constrainedTime, timeline.playhead),
      },
    });
  },

  setOutPoint: (time) => {
    const { timeline, videoFile } = get();
    if (timeline.isOutPointLocked) return;
    const maxTime = videoFile?.duration ?? 0;
    const constrainedTime = Math.max(timeline.inPoint, Math.min(time, maxTime));
    set({
      timeline: {
        ...timeline,
        outPoint: constrainedTime,
        playhead: Math.min(constrainedTime, timeline.playhead),
      },
    });
  },

  setPlayhead: (time) => {
    const { timeline } = get();
    const constrainedTime = Math.max(
      timeline.inPoint,
      Math.min(time, timeline.outPoint)
    );
    set({
      timeline: { ...timeline, playhead: constrainedTime },
    });
  },

  setInPointLocked: (locked) =>
    set((state) => ({
      timeline: { ...state.timeline, isInPointLocked: locked },
    })),

  setOutPointLocked: (locked) =>
    set((state) => ({
      timeline: { ...state.timeline, isOutPointLocked: locked },
    })),

  setZoom: (zoom) =>
    set((state) => ({
      timeline: { ...state.timeline, zoom: Math.max(0.1, Math.min(zoom, 10)) },
    })),

  resetTimeline: () => {
    const duration = get().videoFile?.duration ?? 0;
    set({
      timeline: {
        inPoint: 0,
        outPoint: duration,
        playhead: 0,
        isInPointLocked: false,
        isOutPointLocked: false,
        zoom: 1,
      },
    });
  },

  // 진행률 관련
  setUploadProgress: (progress) =>
    set((state) => ({
      processing: { ...state.processing, uploadProgress: progress },
    })),

  setTrimProgress: (progress) =>
    set((state) => ({
      processing: { ...state.processing, trimProgress: progress },
    })),

  setWaveformProgress: (progress) =>
    set((state) => ({
      processing: { ...state.processing, waveformProgress: progress },
    })),

  // 플레이어 관련
  setIsPlaying: (playing) =>
    set((state) => ({ player: { ...state.player, isPlaying: playing } })),

  setCurrentTime: (time) =>
    set((state) => ({ player: { ...state.player, currentTime: time } })),

  setVolume: (volume) =>
    set((state) => ({
      player: { ...state.player, volume: Math.max(0, Math.min(volume, 1)) },
    })),

  setIsMuted: (muted) =>
    set((state) => ({ player: { ...state.player, isMuted: muted } })),

  setIsScrubbing: (scrubbing) =>
    set((state) => ({ player: { ...state.player, isScrubbing: scrubbing } })),

  // 에러 관련
  setError: (message, code) =>
    set({
      error: { hasError: true, errorMessage: message, errorCode: code ?? null },
    }),

  clearError: () =>
    set({
      error: { hasError: false, errorMessage: null, errorCode: null },
    }),

  // 내보내기 관련
  setExportResult: (url, filename) =>
    set({
      export: { outputUrl: url, outputFilename: filename },
    }),

  clearExportResult: () => {
    const { export: exportState } = get();
    if (exportState.outputUrl) {
      URL.revokeObjectURL(exportState.outputUrl);
    }
    set({ export: { outputUrl: null, outputFilename: null } });
  },

  // 전체 리셋
  reset: () => {
    const { videoFile, export: exportState } = get();
    if (videoFile?.url) {
      URL.revokeObjectURL(videoFile.url);
    }
    if (exportState.outputUrl) {
      URL.revokeObjectURL(exportState.outputUrl);
    }
    // Clean up FFmpeg singleton to free memory
    cleanupFFmpeg();
    set(initialState);
  },

  // 복합 액션 (상태 + 페이즈 전환)
  setErrorAndTransition: (message, code) => {
    set({
      error: { hasError: true, errorMessage: message, errorCode: code ?? null },
      phase: 'error',
    });
  },

  setExportResultAndComplete: (url, filename) => {
    set({
      export: { outputUrl: url, outputFilename: filename },
      phase: 'completed',
    });
  },
}));
