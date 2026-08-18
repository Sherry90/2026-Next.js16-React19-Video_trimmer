"use client";

import { useTrimPoints, useVideoDuration, useTrimLocks, useTimelineActions } from "@/stores/hooks";
import { usePreviewPlaybackContext } from "../context/PreviewPlaybackContext";
import { TimeInput } from "./TimeInput";
import { LockButton } from "./LockButton";
import { PreviewButtons } from "./PreviewButtons";
import { OutputGainControl } from "./OutputGainControl";

/**
 * Timeline controls (connected) — time inputs, lock buttons, preview buttons.
 * 스토어를 직접 소비하고 순수 하위 모듈을 1단계 props로 합성한다
 * (기존 TimelineEditor→TimelineControls 11-prop pass-through 제거).
 */
export function TimelineControls() {
  const { inPoint, outPoint } = useTrimPoints();
  const duration = useVideoDuration();
  const { isInPointLocked, isOutPointLocked } = useTrimLocks();
  const { setInPoint, setOutPoint, setInPointLocked, setOutPointLocked } = useTimelineActions();
  const { handlePreviewEdges } = usePreviewPlaybackContext();

  return (
    <div className="px-4 pb-4 flex items-center justify-between gap-4">
      {/* Time inputs */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <TimeInput
            label="In"
            value={inPoint}
            onChange={(value) => {
              if (value !== null) setInPoint(value);
            }}
            min={0}
            max={outPoint}
            disabled={isInPointLocked}
          />
          <LockButton
            locked={isInPointLocked}
            onToggle={() => setInPointLocked(!isInPointLocked)}
            label="In Point"
          />
        </div>
        <div className="flex items-center gap-2">
          <TimeInput
            label="Out"
            value={outPoint}
            onChange={(value) => {
              if (value !== null) setOutPoint(value);
            }}
            min={inPoint}
            max={duration}
            disabled={isOutPointLocked}
          />
          <LockButton
            locked={isOutPointLocked}
            onToggle={() => setOutPointLocked(!isOutPointLocked)}
            label="Out Point"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* 출력 게인 — 결과물과 미리보기에 적용(PlayerControls의 볼륨/뮤트와 별개) */}
        <OutputGainControl />

        {/* Preview button */}
        <PreviewButtons onPreviewEdges={handlePreviewEdges} />
      </div>
    </div>
  );
}
