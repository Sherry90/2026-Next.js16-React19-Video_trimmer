import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseClipMpd, parseIso8601Duration, pickClipSource } from "@/lib/chzzkClip";

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), "src/__tests__/fixtures", name), "utf-8");

// 실측 chzzk playback MPD (hdnts 토큰/시간 스크럽)
const MULTI = fixture("chzzk-clip-multi.mpd.xml"); // 720P + 480P (세로 클립), BaseURL 4개
const SINGLE = fixture("chzzk-clip-single.mpd.xml"); // 720P 단일 (가로 클립), BaseURL 2개

describe("parseIso8601Duration", () => {
  it("초/분 단위 파싱", () => {
    expect(parseIso8601Duration("PT25.200S")).toBeCloseTo(25.2);
    expect(parseIso8601Duration("PT1M29.000S")).toBeCloseTo(89);
    expect(parseIso8601Duration("PT1H2M3S")).toBeCloseTo(3723);
  });

  it("형식이 아니면 0", () => {
    expect(parseIso8601Duration("25s")).toBe(0);
    expect(parseIso8601Duration("")).toBe(0);
  });
});

describe("parseClipMpd", () => {
  it("단일 화질 MPD에서 progressive MP4 표현 추출", () => {
    const { duration, sources } = parseClipMpd(SINGLE);

    expect(duration).toBeCloseTo(25.2);
    expect(sources).toHaveLength(1);
    expect(sources[0].height).toBe(720);
    expect(sources[0].width).toBe(1280);
    expect(sources[0].bandwidth).toBeGreaterThan(0);
    expect(sources[0].codecs).toContain("avc1");
    expect(sources[0].url).toMatch(/^https:\/\/.+\.mp4/);
  });

  it("다중 화질 MPD에서 mp4 표현만 추출 (mp2t AdaptationSet 배제)", () => {
    const { duration, sources } = parseClipMpd(MULTI);

    // mp2t AdaptationSet의 Representation은 mimeType을 생략(부모 상속)하므로
    // AdaptationSet 블록을 먼저 잘라내지 않으면 BaseURL 짝이 어긋난다.
    expect(duration).toBeCloseTo(60.054);
    expect(sources).toHaveLength(2);
    expect(sources.every((s) => /\.mp4/.test(s.url))).toBe(true);
    expect(sources.some((s) => /hls|m3u8/.test(s.url))).toBe(false);
  });

  it("짧은 변 기준 오름차순 정렬 (세로 클립 포함)", () => {
    const { sources } = parseClipMpd(MULTI);

    // 세로 클립: 720p 프로파일이 width=720 height=1280으로 들어온다
    expect(sources.map((s) => Math.min(s.width, s.height))).toEqual([480, 720]);
  });

  it("mp4 표현이 없으면 빈 배열", () => {
    expect(parseClipMpd("<MPD></MPD>").sources).toEqual([]);
  });
});

describe("pickClipSource", () => {
  const multi = parseClipMpd(MULTI).sources;

  it("기본(1080 상한)은 최고 화질 — 세로 클립도 720p 선택", () => {
    const picked = pickClipSource(multi);
    expect(Math.min(picked.width, picked.height)).toBe(720);
  });

  it("maxHeight 이하 중 최고 화질", () => {
    const at480 = pickClipSource(multi, 480);
    expect(Math.min(at480.width, at480.height)).toBe(480);

    const at720 = pickClipSource(multi, 720);
    expect(Math.min(at720.width, at720.height)).toBe(720);
  });

  it("maxHeight보다 낮은 화질이 없으면 최저 화질로 폴백", () => {
    const picked = pickClipSource(multi, 144);
    expect(Math.min(picked.width, picked.height)).toBe(480);
  });

  it("표현이 없으면 에러", () => {
    expect(() => pickClipSource([])).toThrow();
  });
});
