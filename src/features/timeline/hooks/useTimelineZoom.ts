import { useEffect, RefObject } from 'react';
import { UI } from '@/constants/appConfig';

/**
 * Hook for managing timeline zoom functionality with Ctrl+wheel
 * @param timelineRef - Ref to the timeline element
 * @param zoom - Current zoom level
 * @param setZoom - Function to update zoom level
 */
export function useTimelineZoom(
  timelineRef: RefObject<HTMLDivElement | null>,
  zoom: number,
  setZoom: (zoom: number) => void
) {
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      // Only zoom when Ctrl is pressed
      if (!event.ctrlKey) return;

      event.preventDefault();
      const zoomDelta = event.deltaY > 0 ? -UI.TIMELINE_ZOOM_STEP : UI.TIMELINE_ZOOM_STEP;
      const newZoom = zoom + zoomDelta;
      setZoom(newZoom);
    };

    const timelineElement = timelineRef.current;
    if (timelineElement) {
      timelineElement.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (timelineElement) {
        timelineElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, [zoom, setZoom, timelineRef]);
}
