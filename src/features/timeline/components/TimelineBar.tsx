"use client";

import { useEffect, useRef, useState } from "react";
import { useVideoDuration, useTrimPoints, useTimelineZoomValue } from "@/stores/hooks";
import { TIMELINE } from "@/constants/appConfig";
import { formatSimpleTime } from "@/shared/lib/timeFormatter";
import { WaveformBackground } from "./WaveformBackground";
import { useTimelineZoom } from "../hooks/useTimelineZoom";
import { useRulerScrub } from "../hooks/useRulerScrub";

interface TimelineBarProps {
  /** 트랙 본체 오버레이 — trim 핸들. */
  children?: React.ReactNode;
  /** 룰러+트랙을 관통하는 playhead 오버레이. */
  playhead?: React.ReactNode;
}

export function TimelineBar({ children, playhead }: TimelineBarProps) {
  const duration = useVideoDuration();
  const { inPoint, outPoint } = useTrimPoints();
  const zoom = useTimelineZoomValue();
  // 파형/스펙트럴을 항상 겹쳐 표시하므로 토글 비활성(아래 버튼 주석). 롤백 시 함께 복구.
  // const waveformDisplayMode = useWaveformDisplayMode();
  // const { setWaveformDisplayMode } = useTimelineActions();

  const viewportRef = useRef<HTMLDivElement>(null);
  const rulerRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(0);

  // 룰러 클릭/스크럽 → playhead 절대 seek (트랙 본체 클릭은 seek 안 함 → trim 오조작 방지)
  const { handleMouseDown: handleRulerMouseDown } = useRulerScrub(rulerRef);

  // 휠 줌(커서 기준) + Shift+휠 가로 패닝 — scroll viewport 요소에 부착
  useTimelineZoom(viewportRef);

  // 뷰포트(고정 폭) 측정 → content track 폭 계산의 하한(fit)으로 사용
  useEffect(() => {
    const target = viewportRef.current;
    if (!target) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportWidth(entry.contentRect.width);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // 모든 레이어 공통 축척: time → x 는 contentWidth 위에서 동일(선형 → time 비율 유지).
  // zoom=1 은 화면(viewport)에 정확히 맞춤. zoom>1 일 때만 그 배수로 넓어져 가로 스크롤.
  // (zoom<1 은 화면보다 작아질 뿐이라 1로 하한.)
  const contentWidth = Math.min(TIMELINE.MAX_CONTENT_PX, viewportWidth * Math.max(1, zoom));

  const inPosition = duration > 0 ? (inPoint / duration) * 100 : 0;
  const outPosition = duration > 0 ? (outPoint / duration) * 100 : 100;

  return (
    <div className="w-full h-[168px]">
      {/* Timeline Wrapper with padding */}
      <div className="h-full pt-4 px-4">
        {/* Scroll viewport — 줌 시 content track 이 넓어지며 가로 스크롤 */}
        <div
          ref={viewportRef}
          data-testid="timeline-viewport"
          className="relative w-full overflow-x-auto overflow-y-hidden"
        >
          {/* Content track — 모든 레이어 공통 폭(contentWidth) */}
          <div
            data-testid="timeline-content"
            className="relative"
            style={{ width: contentWidth > 0 ? `${contentWidth}px` : "100%" }}
          >
            {/* Ruler strip — 클릭/스크럽 seek 전용 영역(playhead grip 은 오버레이가 담당) */}
            <div
              ref={rulerRef}
              data-testid="timeline-ruler"
              onMouseDown={handleRulerMouseDown}
              className="relative w-full h-[20px] mb-1 rounded-t bg-[#16171a] border-b border-[#2a2c31] cursor-pointer select-none"
            />

            {/* Timeline main area */}
            <div className="relative w-full h-[80px] bg-[#1c1d20] rounded overflow-hidden">
              {/* Waveform background */}
              <div className="absolute inset-0 pointer-events-none">
                <WaveformBackground />
              </div>

              {/* Darkened regions (non-selected) */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Left darkened area (before in point) */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-black/60"
                  style={{
                    width: `${inPosition}%`,
                  }}
                />
                {/* Right darkened area (after out point) */}
                <div
                  className="absolute top-0 bottom-0 right-0 bg-black/60"
                  style={{
                    left: `${outPosition}%`,
                  }}
                />
              </div>

              {/* Trim 핸들 — 트랙 본체에만(grab Y존 = 트랙) */}
              <div className="absolute inset-0">{children}</div>
            </div>

            {/* Playhead 오버레이 — 룰러(20)+mb(4)+트랙(80)=104px 관통. pe-none, grip만 pe-auto */}
            <div className="absolute top-0 left-0 right-0 h-[104px] pointer-events-none">
              {playhead}
            </div>

            {/* Time ruler — content 와 동일 폭, 함께 스크롤 */}
            <div className="w-full flex justify-between items-center h-[22px] mt-3 text-[11px] text-[#74808c]">
              <span>{formatSimpleTime(0)}</span>
              <span>{formatSimpleTime(duration)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
