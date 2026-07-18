"use client";

import { VideoPlayerView } from "@/features/player/components/VideoPlayerView";
import { TimelineEditor } from "@/features/timeline/components/TimelineEditor";
import { useEditingShortcuts } from "@/features/timeline/hooks/useEditingShortcuts";
import { PreviewPlaybackProvider } from "@/features/timeline/context/PreviewPlaybackContext";

// Provider 하위 — 키보드 단축키와 TimelineEditor(컨트롤 버튼)가 동일 preview 인스턴스를 공유.
function TimelineWithShortcuts() {
  // 키보드 단축키 결선(store·player 로직은 hook이 담당).
  useEditingShortcuts();

  return (
    <div className="h-[250px] min-h-[250px] bg-[#101114] border-t border-black">
      <TimelineEditor />
    </div>
  );
}

export function EditingSection() {
  return (
    <VideoPlayerView>
      <PreviewPlaybackProvider>
        <TimelineWithShortcuts />
      </PreviewPlaybackProvider>
    </VideoPlayerView>
  );
}
