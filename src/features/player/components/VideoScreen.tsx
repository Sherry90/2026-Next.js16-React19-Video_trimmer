"use client";

import { type RefObject } from "react";

interface VideoScreenProps {
  /** video.js가 마운트되는 컨테이너 ref (플레이어 lifecycle은 VideoPlayerView가 소유) */
  videoRef: RefObject<HTMLDivElement | null>;
  hasVideo: boolean;
  /** 영상화면 클릭 시 호출 (재생/일시정지 토글) */
  onScreenClick?: () => void;
}

/**
 * 영상화면 (1) — video.js 마운트 지점.
 * 플레이어 생성/이벤트/dispose는 부모(VideoPlayerView)가 관리하고, 이 컴포넌트는
 * 마운트 컨테이너와 로딩 상태만 렌더한다. 디자인 시스템에는 순수 VideoScreenPlaceholder를 노출.
 */
export function VideoScreen({ videoRef, hasVideo, onScreenClick }: VideoScreenProps) {
  if (!hasVideo) {
    return (
      <div className="text-white p-5 text-center aspect-video flex items-center justify-center">
        Loading video...
      </div>
    );
  }
  // fill 모드 video.js는 부모가 definite height여야 채워진다 → 마운트 div를 w/h-full로.
  return <div ref={videoRef} data-vjs-player onClick={onScreenClick} className="w-full h-full" />;
}
