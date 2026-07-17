'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useTrimPoints } from '@/stores/hooks';
import { usePreviewPlayback } from '../hooks/usePreviewPlayback';

interface PreviewPlaybackValue {
  /** 선택 구간 전체 미리보기(in point부터). */
  handlePreview: () => void;
  /** 앞/뒤 5초 엣지 미리보기(짧은 구간은 전체). */
  handlePreviewEdges: () => void;
}

const PreviewPlaybackContext = createContext<PreviewPlaybackValue | null>(null);

/**
 * preview 재생 컨트롤러 단일 소유자.
 *
 * usePreviewPlayback을 한 번만 인스턴스화해 같은 player에 리스너가 이중 부착되는 것을 막는다.
 * (버튼=TimelineControls, 키보드=useEditingShortcuts가 각자 호출하던 것을 하나로 통합.)
 * VideoPlayerContext를 요구하므로 VideoPlayerView Provider 하위에 위치해야 한다.
 */
export function PreviewPlaybackProvider({ children }: { children: ReactNode }) {
  const { inPoint, outPoint } = useTrimPoints();
  const value = usePreviewPlayback(inPoint, outPoint);
  return (
    <PreviewPlaybackContext.Provider value={value}>
      {children}
    </PreviewPlaybackContext.Provider>
  );
}

export function usePreviewPlaybackContext(): PreviewPlaybackValue {
  const ctx = useContext(PreviewPlaybackContext);
  if (!ctx) {
    throw new Error('usePreviewPlaybackContext must be used within PreviewPlaybackProvider');
  }
  return ctx;
}
