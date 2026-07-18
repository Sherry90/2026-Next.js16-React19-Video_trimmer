import {
  parseFlexibleDuration,
  parseFFmpegProgress,
  FFmpegProgressTracker,
} from "@/lib/progressParser";

describe("progressParser", () => {
  it("parses clock duration and unit duration", () => {
    expect(parseFlexibleDuration("00:01:30.50")).toBeCloseTo(90.5, 2);
    expect(parseFlexibleDuration("1m30s")).toBeCloseTo(90, 2);
  });

  it("uses latest ffmpeg time value from cumulative logs", () => {
    const logs = "time=00:00:05.00\n...\ntime=00:00:08.00\n";
    expect(parseFFmpegProgress(logs, 10)).toBeCloseTo(80, 2);
  });

  it("parses ffmpeg -progress key/value output", () => {
    const tracker = new FFmpegProgressTracker(10);
    tracker.pushChunk("out_time_ms=5000000\nprogress=continue\n");
    expect(tracker.getProgress()).toBeCloseTo(50, 2);

    tracker.pushChunk("progress=end\n");
    expect(tracker.getProgress()).toBe(100);
  });
});
