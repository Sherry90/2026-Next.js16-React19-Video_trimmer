/**
 * yt-dlp 형식 선택 유틸리티
 *
 * yt-dlp JSON 응답에서 최적의 스트림 URL 선택
 * 우선순위: HLS muxed > HTTPS muxed > any muxed
 */

/**
 * yt-dlp JSON 응답 타입
 */
interface YtdlpFormat {
  url?: string;
  vcodec?: string;
  acodec?: string;
  protocol?: string;
  tbr?: number;
  [key: string]: unknown;
}

interface YtdlpInfo {
  formats?: YtdlpFormat[];
  url?: string;
  title?: string;
  duration?: number;
  thumbnail?: string;
  tbr?: number;
  [key: string]: unknown;
}

export interface FormatSelection {
  url: string;
  streamType: 'hls' | 'mp4';
  tbr: number | null; // Total bitrate (kbps)
}

/**
 * yt-dlp 화질 설정
 */
export interface QualityConfig {
  /** 최대 화질 높이 (예: 1080) */
  maxHeight: number;

  /**
   * 엄격 모드
   * - true: 정확한 화질이 없으면 에러
   * - false: 선호하되 없으면 낮은 화질 허용
   */
  strictMode: boolean;
}

/**
 * 기본 화질 설정: 1080p 선호, fallback 허용
 */
export const DEFAULT_QUALITY: QualityConfig = {
  maxHeight: 1080,
  strictMode: false, // 사용자 친화적
};

/**
 * yt-dlp 정보에서 최적의 형식 선택
 *
 * @param ytdlpInfo - yt-dlp JSON 응답
 * @returns 선택된 형식 또는 null
 */
export function selectBestFormat(ytdlpInfo: YtdlpInfo): FormatSelection | null {
  let streamUrl: string | null = null;
  let streamType: 'hls' | 'mp4' = 'mp4';

  // Step 1: Try to find muxed formats (video+audio)
  if (ytdlpInfo.formats && ytdlpInfo.formats.length > 0) {
    const muxedFormats = ytdlpInfo.formats.filter(
      (f: YtdlpFormat) =>
        f.vcodec &&
        f.vcodec !== 'none' &&
        f.acodec &&
        f.acodec !== 'none' &&
        f.url
    );

    if (muxedFormats.length > 0) {
      // Prefer HLS (small segments, better for proxy streaming)
      const hlsFormats = muxedFormats
        .filter(
          (f: YtdlpFormat) => f.protocol === 'm3u8' || f.protocol === 'm3u8_native'
        )
        .sort((a: YtdlpFormat, b: YtdlpFormat) => (b.tbr || 0) - (a.tbr || 0));

      // Then HTTPS formats
      const httpsFormats = muxedFormats
        .filter((f: YtdlpFormat) => f.protocol === 'https')
        .sort((a: YtdlpFormat, b: YtdlpFormat) => (b.tbr || 0) - (a.tbr || 0));

      let selectedFormat: YtdlpFormat | null = null;
      if (hlsFormats.length > 0) {
        selectedFormat = hlsFormats[0];
        streamUrl = selectedFormat.url ?? null;
        streamType = 'hls';
      } else if (httpsFormats.length > 0) {
        selectedFormat = httpsFormats[0];
        streamUrl = selectedFormat.url ?? null;
        streamType = 'mp4';
      } else {
        // Fallback to any muxed format
        selectedFormat = muxedFormats[muxedFormats.length - 1];
        streamUrl = selectedFormat.url ?? null;
      }

      // streamUrl is guaranteed to be non-null here
      if (streamUrl) {
        return {
          url: streamUrl,
          streamType,
          tbr: selectedFormat?.tbr || null,
        };
      }
    }
  }

  // Step 2: Fallback to top-level url if available
  if (ytdlpInfo.url) {
    return {
      url: ytdlpInfo.url,
      streamType: 'mp4',
      tbr: ytdlpInfo.tbr || null,
    };
  }

  return null;
}

/**
 * yt-dlp 화질 형식 지정자 생성
 *
 * 공식 문서 기반:
 * - https://www.rapidseedbox.com/blog/yt-dlp-complete-guide
 * - https://github.com/yt-dlp/yt-dlp
 *
 * @param config - 화질 설정
 * @returns yt-dlp -f 플래그 값
 *
 * @example
 * // 1080p 선호, 없으면 fallback
 * buildYtdlpFormatSpec({ maxHeight: 1080, strictMode: false })
 * // => "bestvideo[height<=?1080]+bestaudio/best"
 *
 * @example
 * // 1080p 엄격, 없으면 실패
 * buildYtdlpFormatSpec({ maxHeight: 1080, strictMode: true })
 * // => "bestvideo[height<=1080]+bestaudio"
 */
export function buildYtdlpFormatSpec(
  config: QualityConfig = DEFAULT_QUALITY
): string {
  const { maxHeight, strictMode } = config;

  if (strictMode) {
    // 엄격 모드: 정확한 화질 없으면 실패
    return `bestvideo[height<=${maxHeight}]+bestaudio`;
  } else {
    // 유연 모드: 선호하되 fallback 허용 (?)
    return `bestvideo[height<=?${maxHeight}]+bestaudio/best`;
  }
}

/**
 * 사전 정의된 화질 프리셋
 */
export const QUALITY_PRESETS = {
  /** 1080p Full HD (기본값) */
  FHD_1080P: { maxHeight: 1080, strictMode: false } as QualityConfig,

  /** 720p HD */
  HD_720P: { maxHeight: 720, strictMode: false } as QualityConfig,

  /** 480p SD */
  SD_480P: { maxHeight: 480, strictMode: false } as QualityConfig,

  /** 최고 화질 (제한 없음) */
  BEST: { maxHeight: 9999, strictMode: false } as QualityConfig,
} as const;
