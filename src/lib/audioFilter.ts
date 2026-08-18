/**
 * FFmpeg `-af` 값 조립 — 트리밍 경로 전체의 단일 출처.
 *
 * 트리밍은 항상 `asetpts=PTS-STARTPTS`가 필요하고(출력 타임스탬프 0 기준),
 * 출력 게인은 그 앞에 `volume=XdB`로 체이닝한다. `-af` 플래그를 두 번 주면
 * 뒤엣것이 앞엣것을 덮어쓰므로 **반드시 하나의 문자열로 합성**해야 한다.
 *
 * 사용처: accurateTrimmer.buildAccurateFfmpegArgs, byteRangeDownloader.buildEncodeClipArgs
 */

import { AUDIO } from "@/constants/appConfig";

/** 트리밍에 항상 필요한 타임스탬프 리베이스 필터. */
const RESET_PTS = "asetpts=PTS-STARTPTS";

/**
 * 게인을 안전한 유한 dB 값으로 정규화. 범위를 벗어나면 clamp하고,
 * 비유한값·미지정은 0(게인 없음)으로 취급한다. ffmpeg 인자로 들어가는 값이므로
 * 문자열을 그대로 통과시키지 않고 항상 숫자로 환원한다.
 *
 * API/커스텀 서버 경계에서도 이 함수로 clamp한다(클라이언트 값 신뢰 금지).
 * UI 쪽 스텝 반올림·0 스냅은 stores/constraintUtils의 constrainOutputGainDb가 담당.
 */
export function clampGainDb(gainDb?: number | null): number {
  const n = Number(gainDb);
  if (!Number.isFinite(n)) return 0;
  const clamped = Math.max(AUDIO.MIN_GAIN_DB, Math.min(n, AUDIO.MAX_GAIN_DB));
  return Number(clamped.toFixed(1));
}

/**
 * `-af` 값을 만든다. 게인이 0이면 volume 필터를 아예 넣지 않는다
 * (불필요한 필터 삽입 회피 — 기존 출력과 바이트 단위로 동일하게 유지).
 */
export function buildAudioFilter(gainDb?: number | null): string {
  const db = clampGainDb(gainDb);
  if (db === 0) return RESET_PTS;
  return `volume=${db}dB,${RESET_PTS}`;
}
