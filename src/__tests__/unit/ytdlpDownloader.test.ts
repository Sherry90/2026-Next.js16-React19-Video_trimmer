import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { downloadWithYtdlp } from "@/lib/ytdlpDownloader";

const mocks = vi.hoisted(() => ({
  downloadClipByteRange: vi.fn(),
}));

vi.mock("@/lib/binPaths", () => ({
  getYtdlpPath: vi.fn(() => "/usr/local/bin/yt-dlp"),
}));

vi.mock("@/lib/byteRangeDownloader", () => ({
  downloadClipByteRange: mocks.downloadClipByteRange,
}));

describe("ytdlpDownloader partial-only contract", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/ytdlpDownloader.ts"), "utf8");

  it("does not create a full_<jobId> source or invoke aria2c", () => {
    expect(source).not.toContain("full_${jobId}");
    expect(source).not.toContain("downloadFullThenCut");
    expect(source).not.toContain("getAria2cPath");
    expect(source).not.toContain("--external-downloader");
  });

  it("always delegates URL media transfer to the strict byte-range downloader", () => {
    expect(source).toContain("await downloadClipByteRange(");
  });

  it("surfaces partial-download unavailable without invoking another transfer path", async () => {
    mocks.downloadClipByteRange.mockRejectedValueOnce(
      new Error(
        "이 영상은 부분 다운로드를 지원하지 않아 전체 다운로드 없이 처리할 수 없습니다: 200 OK",
      ),
    );
    const emitEvent = vi.fn();
    const updateJobStatus = vi.fn();

    await downloadWithYtdlp(
      "partial-only-test",
      { url: "https://example.invalid/video", startTime: 10, endTime: 20 },
      emitEvent,
      updateJobStatus,
    );

    expect(mocks.downloadClipByteRange).toHaveBeenCalledTimes(1);
    expect(updateJobStatus).toHaveBeenCalledWith(
      "partial-only-test",
      expect.objectContaining({ status: "failed", errorCode: "PARTIAL_DOWNLOAD_UNAVAILABLE" }),
    );
    expect(emitEvent).toHaveBeenLastCalledWith(
      "partial-only-test",
      expect.objectContaining({ type: "error", code: "PARTIAL_DOWNLOAD_UNAVAILABLE" }),
    );
  });
});
