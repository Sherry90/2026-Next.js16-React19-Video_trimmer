import { describe, expect, it } from "vitest";
import { buildAudioFilter, clampGainDb } from "@/lib/audioFilter";
import { buildAccurateFfmpegArgs } from "@/lib/accurateTrimmer";
import { buildEncodeClipArgs } from "@/lib/byteRangeDownloader";
import { AUDIO } from "@/constants/appConfig";

describe("buildAudioFilter", () => {
  it("omits the volume filter at unity gain", () => {
    expect(buildAudioFilter(0)).toBe("asetpts=PTS-STARTPTS");
    expect(buildAudioFilter(undefined)).toBe("asetpts=PTS-STARTPTS");
    expect(buildAudioFilter(null)).toBe("asetpts=PTS-STARTPTS");
  });

  it("chains volume ahead of the timestamp rebase", () => {
    expect(buildAudioFilter(6)).toBe("volume=6dB,asetpts=PTS-STARTPTS");
    expect(buildAudioFilter(-6)).toBe("volume=-6dB,asetpts=PTS-STARTPTS");
    expect(buildAudioFilter(3.5)).toBe("volume=3.5dB,asetpts=PTS-STARTPTS");
  });

  it("treats non-finite gain as unity rather than as an extreme", () => {
    // Infinity를 MAX_GAIN_DB로 clamp하면 사고성 값이 최대 증폭으로 새어 나간다 → 0dB 폴백.
    expect(buildAudioFilter(NaN)).toBe("asetpts=PTS-STARTPTS");
    expect(buildAudioFilter(Infinity)).toBe("asetpts=PTS-STARTPTS");
    expect(buildAudioFilter(-Infinity)).toBe("asetpts=PTS-STARTPTS");
  });

  it("clamps finite out-of-range gain to the configured window", () => {
    expect(clampGainDb(999)).toBe(AUDIO.MAX_GAIN_DB);
    expect(clampGainDb(-999)).toBe(AUDIO.MIN_GAIN_DB);
    expect(clampGainDb(NaN)).toBe(0);
    expect(clampGainDb(Infinity)).toBe(0);
  });

  it("never lets a non-numeric value reach the ffmpeg argument", () => {
    // 문자열이 그대로 통과하면 `volume=6dB; rm -rf /dB` 같은 값이 인자로 들어갈 수 있다.
    const injected = "6dB,areverse" as unknown as number;
    expect(buildAudioFilter(injected)).toBe("asetpts=PTS-STARTPTS");
  });
});

// -af 플래그가 두 개면 뒤엣것이 앞엣것을 덮어써 게인이 조용히 사라진다.
// 두 인자 조립 지점 모두에서 "-af는 정확히 하나"를 고정한다.
const countAf = (args: string[]) => args.filter((arg) => arg === "-af").length;

describe("buildAccurateFfmpegArgs audio gain", () => {
  const base = {
    inputPath: "/tmp/source.mp4",
    outputPath: "/tmp/output.mp4",
    startTime: 4.2,
    duration: 2,
  };

  it("carries the gain in a single -af filter chain", () => {
    const args = buildAccurateFfmpegArgs({ ...base, gainDb: 6 });
    expect(countAf(args)).toBe(1);
    expect(args[args.indexOf("-af") + 1]).toBe("volume=6dB,asetpts=PTS-STARTPTS");
  });

  it("leaves audio untouched at 0 dB", () => {
    const args = buildAccurateFfmpegArgs({ ...base, gainDb: 0 });
    expect(countAf(args)).toBe(1);
    expect(args[args.indexOf("-af") + 1]).toBe("asetpts=PTS-STARTPTS");
    expect(args.join(" ")).not.toContain("volume=");
  });
});

describe("buildEncodeClipArgs audio gain", () => {
  const base = {
    videoFile: "/tmp/clip.v.mp4",
    audioFile: "/tmp/clip.a.mp4",
    outputPath: "/tmp/output.mp4",
    videoSeek: 1.5,
    audioSeek: 1.25,
    duration: 30,
  };

  it("carries the gain in a single -af filter chain", () => {
    const args = buildEncodeClipArgs({ ...base, gainDb: 6 });
    expect(countAf(args)).toBe(1);
    expect(args[args.indexOf("-af") + 1]).toBe("volume=6dB,asetpts=PTS-STARTPTS");
  });

  it("leaves audio untouched at 0 dB", () => {
    const args = buildEncodeClipArgs({ ...base, gainDb: 0 });
    expect(countAf(args)).toBe(1);
    expect(args[args.indexOf("-af") + 1]).toBe("asetpts=PTS-STARTPTS");
    expect(args.join(" ")).not.toContain("volume=");
  });

  it("keeps the byte-range seek/map layout intact", () => {
    const args = buildEncodeClipArgs({ ...base, gainDb: -6 });
    expect(args[args.indexOf("-t") + 1]).toBe("30");
    expect(args.join(" ")).toContain("-map 0:v:0 -map 1:a:0");
    expect(args).not.toContain("copy");
  });
});
