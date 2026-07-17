import { describe, it, expect } from 'vitest';
import { nextZoom, computeZoomAnchor, anchorScrollLeft } from '@/features/timeline/utils/zoomMath';

describe('zoomMath', () => {
  describe('nextZoom', () => {
    it('deltaY<0 이면 줌 증가, >0 이면 감소', () => {
      expect(nextZoom(2, -1, 0.5)).toBe(2.5);
      expect(nextZoom(2, 1, 0.5)).toBe(1.5);
    });
  });

  describe('computeZoomAnchor', () => {
    it('커서 위치 비율 계산', () => {
      // rectLeft=0, scrollLeft=100, scrollWidth=1000, clientX=200 → cursorX=200, ratio=0.3
      const a = computeZoomAnchor(0, 100, 1000, 200);
      expect(a).toEqual({ ratio: 0.3, cursorX: 200 });
    });
    it('scrollWidth 0이면 null', () => {
      expect(computeZoomAnchor(0, 0, 0, 200)).toBeNull();
    });
  });

  describe('anchorScrollLeft', () => {
    it('앵커 기준 보정 scrollLeft', () => {
      // ratio=0.3, cursorX=200, scrollWidth=2000 → 0.3*2000-200 = 400
      expect(anchorScrollLeft({ ratio: 0.3, cursorX: 200 }, 2000)).toBe(400);
    });
  });
});
