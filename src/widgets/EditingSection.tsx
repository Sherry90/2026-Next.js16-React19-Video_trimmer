'use client';

import { VideoPlayerView } from '@/features/player/components/VideoPlayerView';
import { TimelineEditor } from '@/features/timeline/components/TimelineEditor';
import { useEditingShortcuts } from '@/features/timeline/hooks/useEditingShortcuts';

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
      <TimelineWithShortcuts />
    </VideoPlayerView>
  );
}
