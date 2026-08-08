import { describe, expect, it } from "vitest";
import { buildAccurateFfmpegArgs } from "@/lib/accurateTrimmer";

describe("accurateTrimmer command", () => {
  const args = buildAccurateFfmpegArgs({
    inputPath: "/tmp/source.mp4",
    outputPath: "/tmp/output.mp4",
    startTime: 4.2,
    duration: 2,
  });

  it("keeps fast input seeking but does not stream-copy", () => {
    expect(args.indexOf("-ss")).toBeLessThan(args.indexOf("-i"));
    expect(args[args.indexOf("-ss") + 1]).toBe("4.2");
    expect(args).not.toContain("copy");
  });

  it("uses visually lossless H.264/AAC defaults", () => {
    expect(args[args.indexOf("-c:v") + 1]).toBe("libx264");
    expect(args[args.indexOf("-crf") + 1]).toBe("18");
    expect(args[args.indexOf("-preset") + 1]).toBe("veryfast");
    expect(args[args.indexOf("-c:a") + 1]).toBe("aac");
  });

  it("can decode a short raw HLS pre-roll before output seeking", () => {
    const outputSeek = buildAccurateFfmpegArgs({
      inputPath: "/tmp/segments.ts",
      outputPath: "/tmp/output.mp4",
      startTime: 4.2,
      duration: 2,
      seekMode: "output",
    });
    expect(outputSeek.indexOf("-ss")).toBeGreaterThan(outputSeek.indexOf("-i"));
  });

  it("rebases both streams to zero and emits faststart MP4", () => {
    expect(args[args.indexOf("-vf") + 1]).toBe("setpts=PTS-STARTPTS");
    expect(args[args.indexOf("-af") + 1]).toBe("asetpts=PTS-STARTPTS");
    expect(args.join(" ")).toContain("-movflags +faststart");
  });
});
