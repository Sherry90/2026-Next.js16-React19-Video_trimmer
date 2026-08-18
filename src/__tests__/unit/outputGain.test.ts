import { describe, expect, it } from "vitest";
import { constrainOutputGainDb } from "@/stores/constraintUtils";
import { formatGainDb } from "@/features/timeline/utils/formatGainDb";
import { AUDIO } from "@/constants/appConfig";

describe("constrainOutputGainDb", () => {
  it("clamps to the configured dB window", () => {
    expect(constrainOutputGainDb(999)).toBe(AUDIO.MAX_GAIN_DB);
    expect(constrainOutputGainDb(-999)).toBe(AUDIO.MIN_GAIN_DB);
  });

  it("rounds to the step so the slider and the number input agree", () => {
    expect(constrainOutputGainDb(3.3)).toBe(3.5);
    expect(constrainOutputGainDb(3.7)).toBe(3.5);
    expect(constrainOutputGainDb(-6.1)).toBe(-6);
  });

  it("snaps near-zero values to exactly 0 dB", () => {
    expect(constrainOutputGainDb(0.2)).toBe(0);
    expect(constrainOutputGainDb(-0.2)).toBe(0);
    expect(constrainOutputGainDb(0.25)).toBe(0);
  });

  it("falls back to the default for non-finite input", () => {
    expect(constrainOutputGainDb(NaN)).toBe(AUDIO.DEFAULT_GAIN_DB);
    expect(constrainOutputGainDb(Infinity)).toBe(AUDIO.DEFAULT_GAIN_DB);
  });

  it("leaves no floating point residue", () => {
    // 0.1 * 3 류의 잔차가 남으면 ffmpeg 인자에 volume=3.0000000000000004dB가 들어간다.
    expect(constrainOutputGainDb(0.1 + 0.2 + 3)).toBe(3.5);
    expect(String(constrainOutputGainDb(6.4))).toBe("6.5");
  });
});

describe("formatGainDb", () => {
  it("always shows sign and unit for non-zero gain", () => {
    expect(formatGainDb(3)).toBe("+3.0 dB");
    expect(formatGainDb(-6.5)).toBe("-6.5 dB");
  });

  it("shows unity gain without a sign", () => {
    expect(formatGainDb(0)).toBe("0 dB");
  });
});
