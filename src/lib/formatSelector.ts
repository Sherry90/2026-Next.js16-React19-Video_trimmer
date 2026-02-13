/**
 * yt-dlp 형식 선택 유틸리티
 *
 * yt-dlp JSON 응답에서 최적의 스트림 URL 선택
 * 우선순위: HLS muxed > HTTPS muxed > any muxed
 */

export interface FormatSelection {
  url: string;
  streamType: 'hls' | 'mp4';
  tbr: number | null; // Total bitrate (kbps)
}

/**
 * yt-dlp 정보에서 최적의 형식 선택
 *
 * @param ytdlpInfo - yt-dlp JSON 응답
 * @returns 선택된 형식 또는 null
 */
export function selectBestFormat(ytdlpInfo: any): FormatSelection | null {
  let streamUrl: string | null = null;
  let streamType: 'hls' | 'mp4' = 'mp4';

  // Step 1: Try to find muxed formats (video+audio)
  if (ytdlpInfo.formats && ytdlpInfo.formats.length > 0) {
    const muxedFormats = ytdlpInfo.formats.filter(
      (f: any) =>
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
          (f: any) => f.protocol === 'm3u8' || f.protocol === 'm3u8_native'
        )
        .sort((a: any, b: any) => (b.tbr || 0) - (a.tbr || 0));

      // Then HTTPS formats
      const httpsFormats = muxedFormats
        .filter((f: any) => f.protocol === 'https')
        .sort((a: any, b: any) => (b.tbr || 0) - (a.tbr || 0));

      let selectedFormat: any = null;
      if (hlsFormats.length > 0) {
        selectedFormat = hlsFormats[0];
        streamUrl = selectedFormat.url;
        streamType = 'hls';
      } else if (httpsFormats.length > 0) {
        selectedFormat = httpsFormats[0];
        streamUrl = selectedFormat.url;
        streamType = 'mp4';
      } else {
        // Fallback to any muxed format
        selectedFormat = muxedFormats[muxedFormats.length - 1];
        streamUrl = selectedFormat.url;
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
