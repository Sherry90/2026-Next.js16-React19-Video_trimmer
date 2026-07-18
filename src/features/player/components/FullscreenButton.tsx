"use client";

import { FullscreenEnterIcon, FullscreenExitIcon } from "@/shared/ui/icons";
import { IconButton } from "@/shared/ui/IconButton";

interface FullscreenButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * 전체화면 토글 버튼 (프레젠테이셔널 — 순수 props).
 * isFullscreen에 따라 enter/exit 아이콘 전환.
 */
export function FullscreenButton({ isFullscreen, onToggle, className }: FullscreenButtonProps) {
  return (
    <IconButton
      onClick={onToggle}
      aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
      className={className}
    >
      {isFullscreen ? (
        <FullscreenExitIcon className="w-5 h-5" />
      ) : (
        <FullscreenEnterIcon className="w-5 h-5" />
      )}
    </IconButton>
  );
}
