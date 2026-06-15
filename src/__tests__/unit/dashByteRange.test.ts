import { describe, it, expect } from 'vitest';
import { parseInitIndexRange, parseSidx, computeClipByteRange } from '@/lib/dashManifest';

/**
 * 합성 mp4 머리: ftyp(16) + moov(16) + sidx(version0, 3 subsegment).
 * 각 subsegment 1초, 바이트 100/200/300. mediaStart=100.
 *   seg0 [0,1) bytes[100,200)  seg1 [1,2) bytes[200,400)  seg2 [2,3) bytes[400,700)
 */
function buildHead(): Buffer {
  const box = (size: number, type: string) => {
    const b = Buffer.alloc(8);
    b.writeUInt32BE(size, 0);
    b.write(type, 4, 'latin1');
    return b;
  };
  const ftyp = Buffer.concat([box(16, 'ftyp'), Buffer.alloc(8)]); // 16
  const moov = Buffer.concat([box(16, 'moov'), Buffer.alloc(8)]); // 16, moovEnd=31

  const segs = [
    { size: 100, dur: 1000 },
    { size: 200, dur: 1000 },
    { size: 300, dur: 1000 },
  ];
  const sidxBodyLen = 1 + 3 + 4 + 4 + 4 + 4 + 2 + 2 + segs.length * 12; // 24 + 36 = 60
  const sidxSize = 8 + sidxBodyLen; // 68
  const sidx = Buffer.alloc(sidxSize);
  let o = 0;
  sidx.writeUInt32BE(sidxSize, o); o += 4;
  sidx.write('sidx', o, 'latin1'); o += 4;
  sidx.writeUInt8(0, o); o += 1;        // version 0
  o += 3;                               // flags
  sidx.writeUInt32BE(1, o); o += 4;     // reference_ID
  sidx.writeUInt32BE(1000, o); o += 4;  // timescale
  sidx.writeUInt32BE(0, o); o += 4;     // earliest_presentation_time
  sidx.writeUInt32BE(0, o); o += 4;     // first_offset
  o += 2;                               // reserved
  sidx.writeUInt16BE(segs.length, o); o += 2; // reference_count
  for (const s of segs) {
    sidx.writeUInt32BE(s.size & 0x7fffffff, o); o += 4; // reference_type=0 | size
    sidx.writeUInt32BE(s.dur, o); o += 4;
    sidx.writeUInt32BE(0, o); o += 4;   // SAP
  }
  return Buffer.concat([ftyp, moov, sidx]); // sidx at offset 32, end 99
}

describe('DASH byte-range', () => {
  const head = buildHead();

  it('parseInitIndexRange finds moov(init) and sidx ranges', () => {
    const { init, index } = parseInitIndexRange(head);
    expect(init).toEqual([0, 31]);
    expect(index).toEqual([32, 99]);
  });

  it('parseSidx reads timescale, mediaStart and subsegments', () => {
    const { index } = parseInitIndexRange(head);
    const sidx = parseSidx(head, index[0], index[1]);
    expect(sidx.timescale).toBe(1000);
    expect(sidx.earliest).toBe(0);
    expect(sidx.mediaStart).toBe(100); // sidxEnd(99)+1+firstOffset(0)
    expect(sidx.segments).toEqual([
      { size: 100, dur: 1000 },
      { size: 200, dur: 1000 },
      { size: 300, dur: 1000 },
    ]);
  });

  it('computeClipByteRange covers [1, 2.5] with subsegment-aligned bytes', () => {
    const { init, index } = parseInitIndexRange(head);
    const sidx = parseSidx(head, index[0], index[1]);
    const r = computeClipByteRange(sidx, init, 1, 2.5);
    // seg1 [1,2) bytes[200,400) + seg2 [2,3) bytes[400,700) → [200,699]
    expect(r.media).toEqual([200, 699]);
    expect(r.clipStartTime).toBe(1); // seg1 경계(키프레임)부터
    expect(r.init).toEqual([0, 31]);
  });

  it('clip from 0 starts at first subsegment', () => {
    const { init, index } = parseInitIndexRange(head);
    const sidx = parseSidx(head, index[0], index[1]);
    const r = computeClipByteRange(sidx, init, 0, 0.5);
    expect(r.media[0]).toBe(100); // mediaStart
    expect(r.clipStartTime).toBe(0);
  });

  it('rejects hierarchical sidx (reference_type=1)', () => {
    const bad = Buffer.from(head);
    // 첫 엔트리의 reference_type 비트를 1로 (entry 시작 = 32 + 8 + 24 = 64)
    const entryOff = 32 + 8 + 24;
    bad.writeUInt32BE((0x80000000 | 100) >>> 0, entryOff);
    const { index } = parseInitIndexRange(bad);
    expect(() => parseSidx(bad, index[0], index[1])).toThrow(/계층/);
  });
});
