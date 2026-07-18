import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * trimVideo 디스패치(분기 결정) 로직만 검증 — export의 핵심 라우팅:
 * URL→서버 트리밍, mp4 계열→MP4Box, 그 외→FFmpeg(+로드 통지/실패 처리).
 * 각 트리머의 실제 트리밍은 해당 모듈 책임이므로 mock 처리(여기선 "누구를 부르나"만).
 */

vi.mock("@/features/export/utils/trimVideoServer", () => ({
  trimVideoServer: vi.fn(() => Promise.resolve(new Blob(["s"]))),
}));
vi.mock("@/features/export/utils/trimVideoMP4Box", () => ({
  trimVideoMP4Box: vi.fn(() => Promise.resolve(new Blob(["m"]))),
}));
vi.mock("@/features/export/utils/trimVideoFFmpeg", () => ({
  trimVideoFFmpeg: vi.fn(() => Promise.resolve(new Blob(["f"]))),
}));
vi.mock("@/features/export/utils/FFmpegSingleton", () => ({
  FFmpegSingleton: { getInstance: vi.fn(() => Promise.resolve({})), cleanup: vi.fn() },
}));
vi.mock("@/features/export/utils/formatDetector", () => ({
  getTrimmerType: vi.fn(),
}));

import { trimVideo } from "@/features/export/utils/trimVideoDispatcher";
import { trimVideoServer } from "@/features/export/utils/trimVideoServer";
import { trimVideoMP4Box } from "@/features/export/utils/trimVideoMP4Box";
import { trimVideoFFmpeg } from "@/features/export/utils/trimVideoFFmpeg";
import { FFmpegSingleton } from "@/features/export/utils/FFmpegSingleton";
import { getTrimmerType } from "@/features/export/utils/formatDetector";

const fakeFile = () => new File(["x"], "clip.webm", { type: "video/webm" });

describe("trimVideo 디스패치", () => {
  beforeEach(() => vi.clearAllMocks());

  it("URL 소스 → 서버 트리밍(trimVideoServer)", async () => {
    await trimVideo({
      inputFile: null,
      source: "url",
      originalUrl: "https://x/y",
      startTime: 1,
      endTime: 2,
    });
    expect(trimVideoServer).toHaveBeenCalledTimes(1);
    expect(trimVideoServer).toHaveBeenCalledWith(
      expect.objectContaining({ originalUrl: "https://x/y" }),
    );
    expect(trimVideoMP4Box).not.toHaveBeenCalled();
    expect(trimVideoFFmpeg).not.toHaveBeenCalled();
  });

  it("URL 소스인데 originalUrl 없으면 throw", async () => {
    await expect(
      trimVideo({ inputFile: null, source: "url", startTime: 0, endTime: 1 }),
    ).rejects.toThrow(/originalUrl/);
    expect(trimVideoServer).not.toHaveBeenCalled();
  });

  it("파일 + mp4box 타입 → MP4Box (다운로드 없음)", async () => {
    vi.mocked(getTrimmerType).mockReturnValue("mp4box");
    await trimVideo({ inputFile: fakeFile(), source: "file", startTime: 0, endTime: 5 });
    expect(trimVideoMP4Box).toHaveBeenCalledTimes(1);
    expect(FFmpegSingleton.getInstance).not.toHaveBeenCalled();
    expect(trimVideoFFmpeg).not.toHaveBeenCalled();
  });

  it("파일 + 그 외 타입 → FFmpeg + 로드 통지", async () => {
    vi.mocked(getTrimmerType).mockReturnValue("ffmpeg");
    const onFFmpegLoadStart = vi.fn();
    const onFFmpegLoadComplete = vi.fn();
    await trimVideo({
      inputFile: fakeFile(),
      source: "file",
      startTime: 0,
      endTime: 5,
      onFFmpegLoadStart,
      onFFmpegLoadComplete,
    });
    expect(FFmpegSingleton.getInstance).toHaveBeenCalledTimes(1);
    expect(trimVideoFFmpeg).toHaveBeenCalledTimes(1);
    expect(onFFmpegLoadStart).toHaveBeenCalled();
    expect(onFFmpegLoadComplete).toHaveBeenCalled();
  });

  it("FFmpeg 로드 실패해도 onFFmpegLoadComplete 호출 후 throw", async () => {
    vi.mocked(getTrimmerType).mockReturnValue("ffmpeg");
    vi.mocked(FFmpegSingleton.getInstance).mockRejectedValueOnce(new Error("load fail"));
    const onFFmpegLoadComplete = vi.fn();
    await expect(
      trimVideo({
        inputFile: fakeFile(),
        source: "file",
        startTime: 0,
        endTime: 5,
        onFFmpegLoadComplete,
      }),
    ).rejects.toThrow(/load fail/);
    expect(onFFmpegLoadComplete).toHaveBeenCalled();
    expect(trimVideoFFmpeg).not.toHaveBeenCalled();
  });
});
