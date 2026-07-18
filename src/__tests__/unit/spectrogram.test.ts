import { describe, expect, it } from "vitest";
import {
  bucketMagnitudes,
  computeMagnitudeSpectrum,
  hannWindow,
  isValidSpectrogramData,
  spectrogramFrameWidth,
} from "@/shared/lib/spectrogram";
import { computeSpectrogram } from "@/lib/spectrogramCompute";
import { WAVEFORM_VIEW } from "@/constants/appConfig";

describe("spectrogram utilities", () => {
  it("creates a hann window with tapered edges", () => {
    const window = hannWindow(8);
    expect(window[0]).toBeCloseTo(0);
    expect(window[7]).toBeCloseTo(0);
    expect(window[3]).toBeGreaterThan(0.8);
    expect(window[4]).toBeGreaterThan(0.8);
  });

  it("detects a dominant magnitude bin", () => {
    const samples = new Float32Array(32);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 4 * i) / samples.length);
    }

    const spectrum = computeMagnitudeSpectrum(samples);
    const dominantBin = Array.from(spectrum).reduce(
      (best, value, index) => (value > best.value ? { index, value } : best),
      { index: 0, value: 0 },
    ).index;

    expect(dominantBin).toBe(4);
  });

  it("buckets magnitudes by maximum value", () => {
    const buckets = bucketMagnitudes(new Float32Array([0, 1, 0.5, 0.25]), 2);
    expect(buckets).toEqual([1, 0.5]);
  });

  it("maps spectral frames against video duration (single time-base)", () => {
    // audio == video: 프레임이 폭을 정확히 채움
    expect(spectrogramFrameWidth(10, 10, 100, 1000)).toBeCloseTo(10);
    expect(spectrogramFrameWidth(10, 10, 100, 1000) * 100).toBeCloseTo(1000);

    // audio < video: 프레임 총합 폭 < width (우측 여백)
    const fw = spectrogramFrameWidth(5, 10, 100, 1000);
    expect(fw).toBeCloseTo(5);
    expect(fw * 100).toBeCloseTo(500); // 절반만 덮음

    // video 길이 미상 → audio 기준 폴백, 폭 가득 채움
    expect(spectrogramFrameWidth(8, 0, 80, 800) * 80).toBeCloseTo(800);

    // 방어: 프레임/폭 0
    expect(spectrogramFrameWidth(10, 10, 0, 1000)).toBe(0);
    expect(spectrogramFrameWidth(10, 10, 100, 0)).toBe(0);
  });

  it("validates spectrogram response shape", () => {
    expect(
      isValidSpectrogramData({
        duration: 1,
        sampleRate: 8000,
        fftSize: 256,
        frames: [[0, 0.5, 1]],
      }),
    ).toBe(true);
    expect(isValidSpectrogramData({ skipped: true, reason: "too_long" })).toBe(true);
    expect(isValidSpectrogramData({ duration: 1, frames: [["bad"]] })).toBe(false);
    expect(isValidSpectrogramData(null)).toBe(false);
  });
});

describe("computeSpectrogram", () => {
  it("returns empty frames for empty pcm", () => {
    expect(computeSpectrogram(Buffer.alloc(0))).toMatchObject({
      duration: 0,
      sampleRate: 8000,
      fftSize: 256,
      frames: [],
    });
  });

  it("returns normalized frame buckets for pcm audio", () => {
    const sampleCount = 1024;
    const pcm = Buffer.alloc(sampleCount * 2);
    for (let i = 0; i < sampleCount; i++) {
      const sample = Math.round(Math.sin((2 * Math.PI * 8 * i) / 256) * 16000);
      pcm.writeInt16LE(sample, i * 2);
    }

    const data = computeSpectrogram(pcm);
    expect(data.frames.length).toBeGreaterThan(0);
    expect(data.frames[0]).toHaveLength(WAVEFORM_VIEW.SPECTRAL_FREQ_BINS);
    expect(Math.max(...data.frames[0])).toBeGreaterThan(0);
    expect(Math.max(...data.frames[0])).toBeLessThanOrEqual(1);
  });
});
