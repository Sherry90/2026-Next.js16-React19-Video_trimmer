import { describe, expect, it } from "vitest";
import { gainDbToLinear } from "@/lib/previewGain";

describe("gainDbToLinear", () => {
  it("converts unity gain", () => {
    expect(gainDbToLinear(0)).toBe(1);
  });

  it("converts positive dB to a linear boost", () => {
    expect(gainDbToLinear(6)).toBeCloseTo(1.995, 3);
    expect(gainDbToLinear(20)).toBeCloseTo(10);
  });

  it("converts negative dB to a linear attenuation", () => {
    expect(gainDbToLinear(-6)).toBeCloseTo(0.501, 3);
  });

  it("clamps finite values and falls back to 0dB for non-finite values", () => {
    expect(gainDbToLinear(999)).toBeCloseTo(10);
    expect(gainDbToLinear(NaN)).toBe(1);
    expect(gainDbToLinear(null)).toBe(1);
    expect(gainDbToLinear(undefined)).toBe(1);
  });
});
