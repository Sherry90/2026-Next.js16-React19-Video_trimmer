import { describe, it, expect, vi } from "vitest";
import { buildYtdlpArgs, buildFfmpegCutArgs, extractYtdlpError } from "@/lib/ytdlpDownloader";
import { getFfmpegPath } from "@/lib/binPaths";

// Mock binPaths
vi.mock("@/lib/binPaths", () => ({
  getFfmpegPath: vi.fn(() => "/usr/local/bin/ffmpeg"),
  getYtdlpPath: vi.fn(() => "/usr/local/bin/yt-dlp"),
  getAria2cPath: vi.fn(() => "/usr/local/bin/aria2c"),
}));

describe("ytdlpDownloader", () => {
  describe("buildYtdlpArgs", () => {
    const baseParams = {
      url: "https://youtube.com/watch?v=dQw4w9WgXcQ",
      outputPath: "/tmp/output.mp4",
    };

    it("does NOT use --download-sections (full parallel download, local cut instead)", () => {
      const args = buildYtdlpArgs(baseParams);
      expect(args).not.toContain("--download-sections");
    });

    it("uses bundled aria2c path as external downloader when provided", () => {
      const args = buildYtdlpArgs({ ...baseParams, aria2cPath: "/opt/.bin/aria2/aria2c" });
      expect(args).toContain("--external-downloader");
      const i = args.indexOf("--external-downloader");
      expect(args[i + 1]).toBe("/opt/.bin/aria2/aria2c");
      // 다운로더 인자도 함께 전달
      expect(args).toContain("--downloader-args");
    });

    it("omits external downloader when aria2c unavailable (native fallback)", () => {
      const args = buildYtdlpArgs({ ...baseParams, aria2cPath: null });
      expect(args).not.toContain("--external-downloader");
      expect(args).not.toContain("--downloader-args");
    });

    it("uses best quality by default", () => {
      const args = buildYtdlpArgs(baseParams);

      const formatIndex = args.indexOf("-f");
      expect(formatIndex).toBeGreaterThan(-1);
      expect(args[formatIndex + 1]).toBe("bestvideo[height<=?9999]+bestaudio/best");
    });

    it("limits to maxHeight when specified", () => {
      const args = buildYtdlpArgs({ ...baseParams, maxHeight: 1080 });

      const formatIndex = args.indexOf("-f");
      expect(args[formatIndex + 1]).toBe("bestvideo[height<=?1080]+bestaudio/best");
    });

    it("uses best quality when maxHeight is 0/undefined", () => {
      const args = buildYtdlpArgs({ ...baseParams, maxHeight: 0 });
      const formatIndex = args.indexOf("-f");
      expect(args[formatIndex + 1]).toBe("bestvideo[height<=?9999]+bestaudio/best");
    });

    it("uses 8 concurrent threads for parallel download", () => {
      const args = buildYtdlpArgs(baseParams);

      expect(args).toContain("-N");
      const concurrentIndex = args.indexOf("-N");
      expect(args[concurrentIndex + 1]).toBe("8");
    });

    it("specifies ffmpeg location", () => {
      const args = buildYtdlpArgs(baseParams);

      expect(args).toContain("--ffmpeg-location");
      const ffmpegIndex = args.indexOf("--ffmpeg-location");
      expect(args[ffmpegIndex + 1]).toBe(getFfmpegPath());
    });

    it("includes --no-playlist flag", () => {
      const args = buildYtdlpArgs(baseParams);
      expect(args).toContain("--no-playlist");
    });

    it("includes --newline flag for progress parsing", () => {
      const args = buildYtdlpArgs(baseParams);
      expect(args).toContain("--newline");
    });

    it("forces mp4 output format to prevent extension mismatch", () => {
      const args = buildYtdlpArgs(baseParams);

      expect(args).toContain("--merge-output-format");
      const formatIndex = args.indexOf("--merge-output-format");
      expect(args[formatIndex + 1]).toBe("mp4");
    });

    it("includes output path with -o flag", () => {
      const args = buildYtdlpArgs(baseParams);

      expect(args).toContain("-o");
      const outputIndex = args.indexOf("-o");
      expect(args[outputIndex + 1]).toBe(baseParams.outputPath);
    });

    it("includes URL as last argument", () => {
      const args = buildYtdlpArgs(baseParams);
      expect(args[args.length - 1]).toBe(baseParams.url);
    });
  });

  describe("buildFfmpegCutArgs", () => {
    const cut = () => buildFfmpegCutArgs("/tmp/full.mp4", "/tmp/out.mp4", 60, 120);

    it("fast-seeks with -ss before -i and cuts duration with -t", () => {
      const args = cut();
      const ssIndex = args.indexOf("-ss");
      const iIndex = args.indexOf("-i");
      const tIndex = args.indexOf("-t");
      expect(ssIndex).toBeGreaterThan(-1);
      expect(args[ssIndex + 1]).toBe("60");
      expect(ssIndex).toBeLessThan(iIndex); // -ss before -i = fast keyframe seek
      expect(args[tIndex + 1]).toBe("120");
    });

    it("stream-copies (no re-encode)", () => {
      const args = cut();
      const cIndex = args.indexOf("-c");
      expect(args[cIndex + 1]).toBe("copy");
    });

    it("applies faststart and timestamp reset", () => {
      const args = cut().join(" ");
      expect(args).toContain("-movflags +faststart");
      expect(args).toContain("-avoid_negative_ts make_zero");
    });

    it("input is fullPath, last arg is outputPath", () => {
      const args = cut();
      expect(args[args.indexOf("-i") + 1]).toBe("/tmp/full.mp4");
      expect(args[args.length - 1]).toBe("/tmp/out.mp4");
    });
  });

  describe("extractYtdlpError", () => {
    // 사용자가 실제로 본 stderr: ffmpeg 진행 로그만 가득 → 에러 0건이어야 함
    const progressSpam = `1.97x
frame=17472 fps= 59 q=-1.0 size=   31488kB time=00:09:42.94 bitrate= 442.5kbits/s speed=1.97x
frame=17559 fps= 59 q=-1.0 size=   31744kB time=00:09:45.85 bitrate= 443.9kbits/s speed=1.97x    `;

    it("strips ffmpeg progress lines (frame=/size=time=bitrate)", () => {
      expect(extractYtdlpError(progressSpam)).toBe("");
    });

    it("strips yt-dlp [download] percent lines", () => {
      const s = "[download]  45.2% of 10.00MiB at 1.20MiB/s ETA 00:05\n[download] 100% of 10.00MiB";
      expect(extractYtdlpError(s)).toBe("");
    });

    it("surfaces real error lines through progress noise", () => {
      const s = `frame=100 fps=59 q=-1.0 size=512kB time=00:00:03 bitrate=400kbits/s speed=2x
ERROR: [youtube] video unavailable: This video is private
frame=200 fps=59 q=-1.0 size=1024kB time=00:00:06 bitrate=400kbits/s speed=2x`;
      expect(extractYtdlpError(s)).toContain("This video is private");
      expect(extractYtdlpError(s)).not.toContain("frame=");
    });

    it("detects HTTP 403 / forbidden as signal", () => {
      const s =
        "frame=10 fps=59 q=-1.0 size=1kB time=00:00:01 bitrate=1kbits/s speed=2x\nHTTP Error 403: Forbidden";
      expect(extractYtdlpError(s)).toContain("403");
    });
  });
});
