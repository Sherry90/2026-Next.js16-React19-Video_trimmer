/**
 * 플랫폼 감지 및 다운로드 전략 선택
 *
 * URL 도메인을 분석하여 적절한 다운로드 도구를 선택합니다.
 */

export type Platform = "chzzk" | "youtube" | "generic";
export type DownloadStrategy = "streamlink" | "ytdlp";

/**
 * URL에서 플랫폼 감지 (도메인 기반)
 */
export function detectPlatform(url: string): Platform {
  try {
    const domain = new URL(url).hostname.toLowerCase();

    if (domain.includes("chzzk.naver.com")) {
      return "chzzk";
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
 * 플랫폼에 따라 다운로드 전략 선택 (chzzk → streamlink, 그 외 → yt-dlp)
 *
 * @param platform - 감지된 플랫폼 (전략을 결정하는 유일한 기준)
 * @param streamType - 현재 미사용. 향후 스트림 타입별 분기를 위한 예약 파라미터
 */
export function selectDownloadStrategy(
  platform: Platform,
  streamType: "hls" | "mp4" = "mp4",
): DownloadStrategy {
  // 치지직은 HLS 전문가인 streamlink 사용
  if (platform === "chzzk") {
    return "streamlink";
  }

  // 유튜브 및 기타 플랫폼은 범용 도구인 yt-dlp 사용
  return "ytdlp";
}
