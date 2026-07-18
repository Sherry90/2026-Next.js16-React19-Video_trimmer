import { useStore } from "./useStore";

/**
 * 비반응형(render 밖) 스토어 접근면.
 *
 * video.js 이벤트 콜백·drag·wheel 핸들러처럼 리렌더보다 빠르게 발생해
 * stale-closure를 피하려 라이브 값을 읽어야 하는 곳에서 사용한다. 이 접근은 정당하며,
 * 다만 store 밖에서 useStore.getState()를 직접 부르지 않도록 여기로 일원화한다.
 * (반응형 구독이 필요하면 ./hooks 를 쓴다.)
 */

/** 미디어 스냅샷(videoFile + selectedQuality). */
export const getMediaSnapshot = () => {
  const s = useStore.getState();
  return { videoFile: s.videoFile, selectedQuality: s.selectedQuality };
};

/** 타임라인 스냅샷. */
export const getTimelineSnapshot = () => useStore.getState().timeline;

/** 플레이어 상태 스냅샷. */
export const getPlayerSnapshot = () => useStore.getState().player;

/** 처리 상태 스냅샷. */
export const getProcessingSnapshot = () => useStore.getState().processing;

/** 현재 선택 화질. */
export const getSelectedQuality = () => useStore.getState().selectedQuality;

/** 모든 액션(setter/오케스트레이터) 접근 — 콜백에서 imperative 호출용. */
export const getStoreActions = () => useStore.getState();
