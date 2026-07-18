"use client";

import { TimelineBar } from "./TimelineBar";
import { TrimHandle } from "./TrimHandle";
import { Playhead } from "./Playhead";
import { TimelineControls } from "./TimelineControls";

/**
 * Timeline editor component for video trimming.
 * 레이아웃만 담당 — 타임라인 바(핸들/플레이헤드)와 컨트롤은 각자 스토어를 직접 소비한다.
 */
export function TimelineEditor() {
  return (
    <div className="w-full h-full">
      {/* Timeline Bar */}
      <TimelineBar>
        <TrimHandle type="in" />
        <TrimHandle type="out" />
        <Playhead />
      </TimelineBar>

      {/* Controls */}
      <TimelineControls />
    </div>
  );
}
