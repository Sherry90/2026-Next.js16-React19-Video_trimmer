import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type Player from "video.js/dist/types/player";
import { usePreviewPlayback } from "@/features/timeline/hooks/usePreviewPlayback";
import { VideoPlayerProvider } from "@/shared/video-player/VideoPlayerContext";
import { PLAYBACK } from "@/constants/appConfig";

/**
 * usePreviewPlayback 핵심 계약(buffer-aware)만 검증:
 * - seek 후 준비(seeked + readyState/canplay) 전에는 play() 하지 않는다 (스트리밍 stall 방지).
 * - isScrubbing 수명: 시작 시 true, 재생 재개(playing) 또는 안전 타임아웃 시 false.
 * - edges: 짧은 구간은 전체 재생, 긴 구간은 in+5에서 out-5로 점프.
 * video.js 내부/실제 버퍼링은 테스트 범위 밖(브라우저 검증으로 커버).
 */

interface MockPlayerOpts {
  seeking?: boolean;
  readyState?: number;
  currentTime?: number;
}

function makeMockPlayer(opts: MockPlayerOpts = {}) {
  const listeners: Record<string, Array<{ cb: () => void; once: boolean }>> = {};
  const player = {
    one: vi.fn((e: string, cb: () => void) => {
      (listeners[e] ||= []).push({ cb, once: true });
    }),
    on: vi.fn((e: string, cb: () => void) => {
      (listeners[e] ||= []).push({ cb, once: false });
    }),
    off: vi.fn((e: string, cb: () => void) => {
      if (listeners[e]) listeners[e] = listeners[e].filter((x) => x.cb !== cb);
    }),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    currentTime: vi.fn(() => opts.currentTime ?? 0),
    seeking: vi.fn(() => opts.seeking ?? false),
    readyState: vi.fn(() => opts.readyState ?? 4),
    // 테스트에서 이벤트 수동 발사
    emit(e: string) {
      (listeners[e] ?? []).slice().forEach((x) => {
        if (x.once) listeners[e] = listeners[e].filter((y) => y !== x);
        x.cb();
      });
    },
  };
  return player;
}

function renderPreview(
  inPoint: number,
  outPoint: number,
  mockPlayer: ReturnType<typeof makeMockPlayer>,
) {
  const seek = vi.fn();
  const setIsScrubbing = vi.fn();
  const value = {
    player: mockPlayer as unknown as Player,
    play: vi.fn(),
    pause: vi.fn(),
    seek,
    togglePlay: vi.fn(),
    setIsScrubbing,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <VideoPlayerProvider value={value}>{children}</VideoPlayerProvider>
  );
  const view = renderHook(() => usePreviewPlayback(inPoint, outPoint), { wrapper });
  return { ...view, seek, setIsScrubbing };
}

describe("usePreviewPlayback", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("seek은 즉시, play()는 seeked+준비 이후에만 (준비 전 play 금지)", () => {
    // seeking=true → 동기 fast-path 비활성, 이벤트 경로 강제
    const player = makeMockPlayer({ seeking: true, readyState: 4 });
    const { result, seek, setIsScrubbing } = renderPreview(0, 100, player);

    act(() => result.current.handlePreview());

    expect(setIsScrubbing).toHaveBeenCalledWith(true);
    expect(seek).toHaveBeenCalledWith(0);
    expect(player.play).not.toHaveBeenCalled(); // 아직 준비 안 됨

    act(() => player.emit("seeked")); // readyState 4 ≥ 3 → 즉시 play
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("seeked 시 readyState<3이면 canplay까지 play 대기", () => {
    const player = makeMockPlayer({ seeking: true, readyState: 1 });
    const { result } = renderPreview(0, 100, player);

    act(() => result.current.handlePreview());
    act(() => player.emit("seeked"));
    expect(player.play).not.toHaveBeenCalled(); // 아직 버퍼 부족

    act(() => player.emit("canplay"));
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it("playing 발생 시 isScrubbing 해제", () => {
    const player = makeMockPlayer({ seeking: true, readyState: 4 });
    const { result, setIsScrubbing } = renderPreview(0, 100, player);

    act(() => result.current.handlePreview());
    act(() => player.emit("seeked"));
    setIsScrubbing.mockClear();

    act(() => player.emit("playing"));
    expect(setIsScrubbing).toHaveBeenCalledWith(false);
  });

  it("handlePreviewEdges 짧은 구간(<10s)은 전체 재생 — timeupdate 점프 리스너 미등록", () => {
    const player = makeMockPlayer({ seeking: true, readyState: 4 });
    const { result, seek } = renderPreview(0, 5, player); // 5s < 10s

    act(() => result.current.handlePreviewEdges());

    expect(seek).toHaveBeenCalledWith(0);
    const onTimeupdate = player.on.mock.calls.some(([e]) => e === "timeupdate");
    expect(onTimeupdate).toBe(false);
  });

  it("handlePreviewEdges 긴 구간은 in+5 도달 시 out-5로 점프", () => {
    // seeking=false, currentTime=5 → 시작 재생 후 timeupdate가 점프 트리거
    const player = makeMockPlayer({ seeking: false, readyState: 4, currentTime: 5 });
    const { result, seek } = renderPreview(0, 100, player);

    act(() => result.current.handlePreviewEdges());
    expect(seek).toHaveBeenCalledWith(0); // 시작 지점

    act(() => player.emit("timeupdate")); // currentTime 5 ≥ inPoint(0)+5
    expect(player.pause).toHaveBeenCalled();
    expect(seek).toHaveBeenCalledWith(95); // outPoint(100) - 5
  });

  it("안전 타임아웃: 준비/재생 이벤트 없으면 PREVIEW_BUFFER_TIMEOUT_MS 후 play + isScrubbing 해제", () => {
    vi.useFakeTimers();
    const player = makeMockPlayer({ seeking: true, readyState: 1 }); // 이벤트 안 옴
    const { result, setIsScrubbing } = renderPreview(0, 100, player);

    act(() => result.current.handlePreview());
    setIsScrubbing.mockClear();
    expect(player.play).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(PLAYBACK.PREVIEW_BUFFER_TIMEOUT_MS));
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(setIsScrubbing).toHaveBeenCalledWith(false);
  });
});
