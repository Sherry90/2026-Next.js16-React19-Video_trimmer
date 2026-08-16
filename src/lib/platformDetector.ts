/**
 * 플랫폼 감지 및 다운로드 전략 선택
 *
 * URL 도메인을 분석하여 적절한 다운로드 도구를 선택합니다.
 */

import { getChzzkClipUid } from "@/shared/lib/platformUrl";

export type Platform = "chzzk" | "chzzk-clip" | "youtube" | "generic";
export type DownloadStrategy = "streamlink" | "ytdlp" | "chzzkClip";

/**
 * URL에서 플랫폼 감지 (도메인 + 경로 기반)
 *
 * Chzzk 클립(`/clips/{uid}`)만 경로까지 본다. yt-dlp에는 클립 추출기가 없고
 * streamlink 8.4.0의 클립 경로는 언팩 버그로 실패하므로, 클립은 네이티브 chzzk API
 * 경로(chzzkClip)로 보내야 한다. live/VOD는 종전대로 "chzzk".
 */
export function detectPlatform(url: string): Platform {
  try {
    const domain = new URL(url).hostname.toLowerCase();

    if (domain.includes("chzzk.naver.com")) {
      return getChzzkClipUid(url) ? "chzzk-clip" : "chzzk";
    }

    if (domain.includes("youtube.com") || domain.includes("youtu.be")) {
      return "youtube";
    }

    return "generic";
  } catch {
    // Invalid URL - fallback to generic
    return "generic";
  }
}

/**
 * 플랫폼에 따라 다운로드 전략 선택
 * (chzzk 클립 → 네이티브 chzzk API, 그 외 chzzk → streamlink, 나머지 → yt-dlp)
 *
 * @param platform - 감지된 플랫폼 (전략을 결정하는 유일한 기준)
 * @param streamType - 현재 미사용. 향후 스트림 타입별 분기를 위한 예약 파라미터
 */
export function selectDownloadStrategy(
  platform: Platform,
  _streamType: "hls" | "mp4" = "mp4",
): DownloadStrategy {
  // 치지직 클립은 chzzk API가 주는 progressive MP4를 직접 받는다
  if (platform === "chzzk-clip") {
    return "chzzkClip";
  }

  // 치지직 라이브/VOD는 HLS 전문가인 streamlink 사용
  if (platform === "chzzk") {
    return "streamlink";
  }

  // 유튜브 및 기타 플랫폼은 범용 도구인 yt-dlp 사용
  return "ytdlp";
}
