import { createSimpleSelector, createStateSelector } from "../selectorFactory";

// ── timeline ──
/** 트림 구간(in/out)만 — 자주 쓰는 좁은 구독. */
export const useTrimPoints = createStateSelector((s) => ({
  inPoint: s.timeline.inPoint,
  outPoint: s.timeline.outPoint,
}));

/** 타임라인 줌 배율. */
export const useTimelineZoomValue = createSimpleSelector((s) => s.timeline.zoom);

/** 파형/스펙트럼 표시 모드. */
export const useWaveformDisplayMode = createSimpleSelector(
  (s) => s.timeline.waveformDisplayMode ?? "waveform",
);

/** in/out lock 상태만. */
export const useTrimLocks = createStateSelector((s) => ({
  isInPointLocked: s.timeline.isInPointLocked,
  isOutPointLocked: s.timeline.isOutPointLocked,
}));

export const useTimelineActions = createStateSelector((s) => ({
  setInPoint: s.setInPoint,
  setOutPoint: s.setOutPoint,
  setPlayhead: s.setPlayhead,
  setInPointLocked: s.setInPointLocked,
  setOutPointLocked: s.setOutPointLocked,
  setZoom: s.setZoom,
  setWaveformDisplayMode: s.setWaveformDisplayMode,
  resetTimeline: s.resetTimeline,
}));

/** 트림 경계 설정만 — TrimHandle/단축키 등 구간만 건드리는 소비처용. */
export const useTrimPointActions = createStateSelector((s) => ({
  setInPoint: s.setInPoint,
  setOutPoint: s.setOutPoint,
}));

// ── processing ──
/** 업로드 진행률(0-100). */
export const useUploadProgress = createSimpleSelector((s) => s.processing.uploadProgress);
/** 트림/다운로드 진행률(0-100). */
export const useTrimProgress = createSimpleSelector((s) => s.processing.trimProgress);
/** 파형 추출 진행률(0-100). */
export const useWaveformProgress = createSimpleSelector((s) => s.processing.waveformProgress);

export const useProgressActions = createStateSelector((s) => ({
  setProgress: s.setProgress,
}));
