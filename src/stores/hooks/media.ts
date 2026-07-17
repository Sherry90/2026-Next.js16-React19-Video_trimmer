import { createSimpleSelector, createStateSelector } from '../selectorFactory';

// ── media ──
/** 전체 videoFile 객체. */
export const useVideoFile = createSimpleSelector((s) => s.videoFile);
/** 재생용 URL (Object URL 또는 프록시 URL). */
export const useVideoUrl = createSimpleSelector((s) => s.videoFile?.url);
/** 영상 길이(초). 미로드 시 0. */
export const useVideoDuration = createSimpleSelector((s) => s.videoFile?.duration ?? 0);
/** 선택된 재생 화질(height, px). null = Auto. */
export const useSelectedQuality = createSimpleSelector((s) => s.selectedQuality);

export const useMediaActions = createStateSelector((s) => ({
  setVideoFile: s.setVideoFile,
  setSelectedQuality: s.setSelectedQuality,
  setVideoDuration: s.setVideoDuration,
}));

// ── phase ──
/** 현재 앱 단계. */
export const usePhase = createSimpleSelector((s) => s.phase);

export const usePhaseActions = createStateSelector((s) => ({
  setPhase: s.setPhase,
}));

// ── lifecycle ──
/** 전체 리셋 액션만. */
export const useReset = createSimpleSelector((s) => s.reset);
