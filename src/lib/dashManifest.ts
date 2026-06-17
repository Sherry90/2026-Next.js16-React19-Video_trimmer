/**
 * On-demand DASH MPD 생성 유틸리티.
 *
 * YouTube는 2026년 기준 web 클라이언트에서 고화질을 video-only DASH + 별도 audio로만 제공한다
 * (muxed는 360p itag18 하나뿐, HLS는 PO Token·n-challenge로 차단). 브라우저 <video>는 분리된
 * 스트림을 합쳐 재생 못 하므로, 서버가 yt-dlp가 준 단일파일 DASH(mp4_dash)들을 묶는 정적 MPD를
 * 만들어 video.js VHS(MSE)가 video+audio를 머지·재생하게 한다.
 *
 * 각 표현(Representation)은 단일 파일이라 SegmentBase + sidx(indexRange) 방식을 쓴다. yt-dlp가
 * init/index 바이트 범위를 노출하지 않으므로 파일 머리를 조금 받아 mp4 박스를 직접 워킹해 계산한다.
 */

/** DASH 표현 머리(ftyp+moov+sidx)를 담기 충분한 크기 (관측상 video<2.3KB, audio<1.6KB). */
export const DASH_HEAD_BYTES = 131072; // 128KB

/** mp4 박스 워킹으로 얻은 init segment(ftyp+moov)와 index(sidx)의 바이트 범위. */
export interface InitIndexRange {
  /** Initialization range: [start, end] (inclusive) — ftyp+moov */
  init: [number, number];
  /** SegmentBase indexRange: [start, end] (inclusive) — sidx box */
  index: [number, number];
}

/**
 * 파일 머리 버퍼에서 mp4 top-level 박스를 워킹해 init/index 범위를 계산한다.
 * 레이아웃: `ftyp moov sidx moof mdat …` → init = 0..(moov 끝), index = sidx 박스 전체.
 *
 * @throws moov 또는 sidx를 버퍼 내에서 못 찾으면(머리를 더 받아야 함) Error.
 */
export function parseInitIndexRange(head: Buffer): InitIndexRange {
  let offset = 0;
  let moovEnd = -1;
  let sidxStart = -1;
  let sidxEnd = -1;

  while (offset + 8 <= head.length) {
    let size = head.readUInt32BE(offset);
    const type = head.toString('latin1', offset + 4, offset + 8);

    if (size === 1) {
      // 64-bit largesize
      if (offset + 16 > head.length) break;
      size = Number(head.readBigUInt64BE(offset + 8));
    } else if (size === 0) {
      // 마지막 박스(파일 끝까지) — 머리 버퍼에선 끝을 모르므로 중단
      break;
    }
    if (size < 8) break; // 손상

    const boxEnd = offset + size;

    if (type === 'moov') {
      moovEnd = boxEnd - 1;
    } else if (type === 'sidx') {
      sidxStart = offset;
      sidxEnd = boxEnd - 1;
      break; // 첫 sidx면 충분
    }

    offset = boxEnd;
  }

  if (moovEnd < 0) {
    throw new Error('DASH 박스 파싱 실패: moov 미발견 (머리 버퍼 부족 가능)');
  }
  if (sidxStart < 0) {
    throw new Error('DASH 박스 파싱 실패: sidx 미발견 (머리 버퍼 부족 가능)');
  }

  return { init: [0, moovEnd], index: [sidxStart, sidxEnd] };
}

/** sidx 한 subsegment: 바이트 크기 + 재생시간(timescale 단위). */
export interface SidxSegment {
  size: number;
  dur: number;
}

/** sidx 박스 파싱 결과. */
export interface SidxInfo {
  timescale: number;
  /** earliest_presentation_time (timescale 단위). */
  earliest: number;
  /** 미디어(moof+mdat) 시작 바이트 = sidx 박스 끝 다음 + first_offset. */
  mediaStart: number;
  segments: SidxSegment[];
}

/** 구간 [start,end]를 커버하는 바이트 범위 + 조립 파일의 시작 시각(초). */
export interface ClipByteRange {
  /** init(ftyp+moov) 바이트 범위. */
  init: [number, number];
  /** 미디어 바이트 범위 [start,end] inclusive. */
  media: [number, number];
  /** 조립 파일(init+media)이 표현하는 첫 subsegment의 시작 시각(초). 정밀 컷 seek 기준. */
  clipStartTime: number;
}

/**
 * sidx 박스를 파싱해 subsegment 목록(시간·바이트)을 얻는다.
 * @param head 파일 머리 버퍼 (sidx 박스 전체 포함)
 * @param sidxStart/sidxEnd parseInitIndexRange가 준 sidx 박스 바이트 범위
 * @throws 계층 sidx(reference_type=1)는 미지원
 */
export function parseSidx(head: Buffer, sidxStart: number, sidxEnd: number): SidxInfo {
  let p = sidxStart;
  const type = head.toString('latin1', p + 4, p + 8);
  if (type !== 'sidx') throw new Error(`sidx 박스 아님: ${type}`);
  p += 8;
  const version = head.readUInt8(p); p += 1;
  p += 3; // flags
  p += 4; // reference_ID
  const timescale = head.readUInt32BE(p); p += 4;
  let earliest: number, firstOffset: number;
  if (version === 0) {
    earliest = head.readUInt32BE(p); p += 4;
    firstOffset = head.readUInt32BE(p); p += 4;
  } else {
    earliest = Number(head.readBigUInt64BE(p)); p += 8;
    firstOffset = Number(head.readBigUInt64BE(p)); p += 8;
  }
  p += 2; // reserved
  const refCount = head.readUInt16BE(p); p += 2;

  const segments: SidxSegment[] = [];
  for (let i = 0; i < refCount; i++) {
    const w0 = head.readUInt32BE(p); p += 4;
    const refType = (w0 >>> 31) & 1;
    const size = w0 & 0x7fffffff;
    const dur = head.readUInt32BE(p); p += 4;
    p += 4; // SAP 정보
    if (refType !== 0) throw new Error('계층 sidx(reference_type=1) 미지원');
    segments.push({ size, dur });
  }

  return { timescale, earliest, mediaStart: sidxEnd + 1 + firstOffset, segments };
}

/**
 * [startSec, endSec]를 커버하는 바이트 범위를 계산한다. subsegment는 SAP(키프레임)로 시작하므로
 * 구간 시작을 포함하는 subsegment 경계부터 잡는다(±키프레임 정확도, 기존 stream-copy와 동일).
 */
export function computeClipByteRange(
  sidx: SidxInfo,
  init: [number, number],
  startSec: number,
  endSec: number
): ClipByteRange {
  const { timescale, earliest, mediaStart, segments } = sidx;
  let t = earliest / timescale; // 현재 subseg 시작 시각(초)
  let b = mediaStart;           // 현재 subseg 시작 바이트
  let byteStart = -1, byteEnd = -1, clipStartTime = earliest / timescale;

  for (const s of segments) {
    const segEndT = t + s.dur / timescale;
    const segEndB = b + s.size;
    if (byteStart < 0 && segEndT > startSec) {
      byteStart = b;
      clipStartTime = t;
    }
    if (byteStart >= 0) {
      byteEnd = segEndB - 1;
      if (t >= endSec) break; // end를 지난 subseg까지 포함하고 종료
    }
    t = segEndT;
    b = segEndB;
  }

  if (byteStart < 0) {
    // start가 전체 길이를 넘어감 — 마지막 직전부터
    byteStart = mediaStart;
    byteEnd = b - 1;
    clipStartTime = earliest / timescale;
  }
  return { init, media: [byteStart, byteEnd], clipStartTime };
}

/** MPD video Representation 입력. */
export interface DashVideoRep {
  /** 재생용 절대 URL (보통 /api/video/proxy 경유). */
  url: string;
  /** 정확한 codec 문자열 (예: avc1.64002a). */
  codecs: string;
  width: number;
  height: number;
  /** 프레임레이트 (정수 또는 "30000/1001" 형태 문자열). */
  frameRate: number | string;
  /** bandwidth (bps). */
  bandwidth: number;
  ranges: InitIndexRange;
}

/** MPD audio Representation 입력. */
export interface DashAudioRep {
  url: string;
  codecs: string;
  /** 샘플레이트 (Hz). */
  audioSamplingRate: number;
  /** 채널 수 (기본 2). */
  channels?: number;
  bandwidth: number;
  ranges: InitIndexRange;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function videoRepXml(rep: DashVideoRep): string {
  const [is, ie] = rep.ranges.index;
  const [ns, ne] = rep.ranges.init;
  return `      <Representation id="v${rep.height}" codecs="${xmlEscape(rep.codecs)}" width="${rep.width}" height="${rep.height}" frameRate="${rep.frameRate}" bandwidth="${rep.bandwidth}">
        <BaseURL>${xmlEscape(rep.url)}</BaseURL>
        <SegmentBase indexRange="${is}-${ie}">
          <Initialization range="${ns}-${ne}"/>
        </SegmentBase>
      </Representation>`;
}

function audioRepXml(rep: DashAudioRep): string {
  const [is, ie] = rep.ranges.index;
  const [ns, ne] = rep.ranges.init;
  return `      <Representation id="audio" codecs="${xmlEscape(rep.codecs)}" audioSamplingRate="${rep.audioSamplingRate}" bandwidth="${rep.bandwidth}">
        <AudioChannelConfiguration schemeIdUri="urn:mpeg:dash:23003:3:audio_channel_configuration:2011" value="${rep.channels ?? 2}"/>
        <BaseURL>${xmlEscape(rep.url)}</BaseURL>
        <SegmentBase indexRange="${is}-${ie}">
          <Initialization range="${ns}-${ne}"/>
        </SegmentBase>
      </Representation>`;
}

/** PT{n}S ISO-8601 duration (소수 3자리). */
function isoDuration(sec: number): string {
  return `PT${(Math.max(0, sec)).toFixed(3)}S`;
}

/**
 * 정적(on-demand) MPD 문자열 생성. video AdaptationSet(다중 Representation = 화질 목록) +
 * audio AdaptationSet(단일). video.js VHS가 화질 전환·audio 머지를 처리한다.
 */
export function buildMpd(params: {
  video: DashVideoRep[];
  audio: DashAudioRep;
  durationSec: number;
}): string {
  const { video, audio, durationSec } = params;
  const videoReps = video.map(videoRepXml).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" type="static" minBufferTime="PT1.5S" mediaPresentationDuration="${isoDuration(durationSec)}" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011">
  <Period>
    <AdaptationSet contentType="video" mimeType="video/mp4" segmentAlignment="true" startWithSAP="1">
${videoReps}
    </AdaptationSet>
    <AdaptationSet contentType="audio" mimeType="audio/mp4" segmentAlignment="true" startWithSAP="1">
${audioRepXml(audio)}
    </AdaptationSet>
  </Period>
</MPD>`;
}
