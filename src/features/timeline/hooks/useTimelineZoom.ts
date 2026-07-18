import { useEffect, useLayoutEffect, useRef, RefObject } from "react";
import { UI } from "@/constants/appConfig";
import { useTimelineZoomValue } from "@/stores/hooks";
import { getTimelineSnapshot, getStoreActions } from "@/stores/snapshot";
import {
  nextZoom,
  computeZoomAnchor,
  anchorScrollLeft,
  type ZoomAnchor,
} from "@/features/timeline/utils/zoomMath";

/**
 * 타임라인 줌/패닝 휠 제어.
 * - 일반 휠: 커서 위치를 고정점으로 줌 in/out
 * - Shift+휠: 가로 패닝(scrollLeft 이동)
 *
 * scroll geometry(scrollLeft/scrollWidth/rect)가 필요하므로 scroll viewport 요소에 부착한다.
 * 줌 계산은 zoomMath util, store 접근은 hook(반응형)/snapshot(휠 내부 라이브 read)로 일원화.
 * @param viewportRef - overflow-x-auto scroll viewport (TimelineBar)
 */
export function useTimelineZoom(viewportRef: RefObject<HTMLDivElement | null>) {
  const anchorRef = useRef<ZoomAnchor | null>(null);
  const zoom = useTimelineZoomValue();

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      // Shift+휠 → 가로 패닝
      // macOS는 Shift+마우스휠 시 delta를 deltaX로 보내고 deltaY=0 → 둘 중 0 아닌 값 사용.
      if (event.shiftKey) {
        event.preventDefault();
        viewport.scrollLeft += event.deltaY || event.deltaX;
        return;
      }

      // 일반 휠 → 커서 기준 줌
      event.preventDefault();
      // 라이브 zoom을 snapshot에서 읽어 stale-closure 방지(휠은 리렌더보다 빠르게 발생).
      const currentZoom = getTimelineSnapshot().zoom;
      const newZoom = nextZoom(currentZoom, event.deltaY, UI.TIMELINE_ZOOM_STEP);

      // 커서 앵커 기록 — content 폭은 리렌더 후 갱신되므로 layout effect에서 scrollLeft 보정.
      const rect = viewport.getBoundingClientRect();
      anchorRef.current = computeZoomAnchor(
        rect.left,
        viewport.scrollLeft,
        viewport.scrollWidth,
        event.clientX,
      );

      getStoreActions().setZoom(newZoom);
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [viewportRef]);

  // 줌 변화로 content 폭이 갱신된 직후(paint 전) 커서 고정점 유지하도록 scrollLeft 보정.
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const viewport = viewportRef.current;
    if (!anchor || !viewport) return;
    viewport.scrollLeft = anchorScrollLeft(anchor, viewport.scrollWidth);
    anchorRef.current = null;
  }, [zoom, viewportRef]);
}
