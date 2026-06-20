'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * 전체화면 훅. 영상과 커스텀 컨트롤바를 함께 감싸는 wrapper 요소를 전체화면 타깃으로 한다
 * (video 요소만 풀스크린하면 React 컨트롤이 사라지므로). 네이티브 Fullscreen API 사용.
 *
 * iOS Safari는 임의 요소 풀스크린을 지원하지 않는다 — 그 경우 <video>.webkitEnterFullscreen
 * (네이티브 컨트롤)로 폴백하며, 이때는 커스텀 컨트롤이 보이지 않는 알려진 한계가 있다.
 */
interface FullscreenEl extends HTMLElement {
  webkitRequestFullscreen?: () => void;
}
interface FullscreenDoc extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}

export interface UseFullscreen {
  isFullscreen: boolean;
  toggle: () => void;
}

export function useFullscreen(containerRef: RefObject<HTMLElement | null>): UseFullscreen {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const doc = document as FullscreenDoc;
    const onChange = () => {
      const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsFullscreen(!!fsEl && fsEl === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [containerRef]);

  const toggle = useCallback(() => {
    const el = containerRef.current as FullscreenEl | null;
    if (!el) return;
    const doc = document as FullscreenDoc;
    const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;

    if (fsEl) {
      if (doc.exitFullscreen) doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      return;
    }
    if (el.requestFullscreen) el.requestFullscreen();
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  }, [containerRef]);

  return { isFullscreen, toggle };
}
