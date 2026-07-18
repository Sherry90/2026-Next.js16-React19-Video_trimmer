import { describe, it, expect } from "vitest";
import {
  parseFFmpegProgress,
  calculateProgress,
  estimateRemainingTime,
} from "@/shared/lib/ffmpegLogParser";

describe("parseFFmpegProgress", () => {
  it("전체 진행 라인에서 모든 필드 추출", () => {
    const line =
      "frame=  120 fps= 30 q=-1.0 size=    1024kB time=00:00:04.00 bitrate=2097.2kbits/s speed=1.2x";
    const r = parseFFmpegProgress(line);
    expect(r).not.toBeNull();
    expect(r!.processedTime).toBeCloseTo(4, 2);
    expect(r!.fps).toBe(30);
    expect(r!.speed).toBeCloseTo(1.2, 2);
    expect(r!.bitrate).toBeCloseTo(2097.2, 1);
    expect(r!.size).toBe(1024 * 1024); // kB
  });

  it("time= 없는 라인은 null", () => {
    expect(parseFFmpegProgress("frame=10 fps=30")).toBeNull();
  });

  it("processedTime이 0이면 null (의미 없는 진행)", () => {
    expect(parseFFmpegProgress("time=00:00:00.00 speed=1.0x")).toBeNull();
  });

  it("HH:MM:SS 시/분 누적 계산", () => {
    const r = parseFFmpegProgress("time=01:02:03.50");
    expect(r!.processedTime).toBeCloseTo(3600 + 120 + 3.5, 2);
  });

  it("size 단위 MB 변환", () => {
    const r = parseFFmpegProgress("size=2MB time=00:00:05.00");
    expect(r!.size).toBe(2 * 1024 * 1024);
  });
});

describe("calculateProgress", () => {
  it("총 길이 0 이하는 0", () => {
    expect(calculateProgress(5, 0)).toBe(0);
    expect(calculateProgress(5, -1)).toBe(0);
  });

  it("정상 비율", () => {
    expect(calculateProgress(5, 10)).toBe(50);
  });

  it("100% 초과는 100으로 클램프", () => {
    expect(calculateProgress(15, 10)).toBe(100);
  });
});

describe("estimateRemainingTime", () => {
  it("speed 0 이하는 0", () => {
    expect(estimateRemainingTime(5, 10, 0)).toBe(0);
  });

  it("남은 길이 / speed", () => {
    expect(estimateRemainingTime(4, 10, 2)).toBe(3); // (10-4)/2
  });
});
