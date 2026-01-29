/**
 * Video format detection utilities
 * Determines which trimmer (MP4Box vs FFmpeg) to use based on video format
 */

/**
 * ISO-based formats that can be processed with MP4Box.js
 * These formats use the ISO Base Media File Format (ISOBMFF)
 */
const ISO_FORMATS = [
  'video/mp4',
  'video/quicktime', // .mov
  'video/x-m4v', // .m4v
];

/**
 * Check if a file is an ISO-based format (MP4/MOV/M4V)
 * These formats can be processed with MP4Box.js without re-encoding
 *
 * @param file - The video file to check
 * @returns true if the file is MP4/MOV/M4V, false otherwise
 */
export function isISOFormat(file: File): boolean {
  return ISO_FORMATS.includes(file.type);
}

/**
 * Determine which trimmer should be used for a video file
 *
 * @param file - The video file to process
 * @returns 'mp4box' for ISO formats, 'ffmpeg' for other formats
 */
export function getTrimmerType(file: File): 'mp4box' | 'ffmpeg' {
  return isISOFormat(file) ? 'mp4box' : 'ffmpeg';
}

/**
 * Check if processing a file will require downloading FFmpeg
 * MP4/MOV/M4V files can be processed with the already-bundled MP4Box.js
 *
 * @param file - The video file to check
 * @returns true if FFmpeg download is required, false if MP4Box can handle it
 */
export function requiresFFmpegDownload(file: File): boolean {
  return getTrimmerType(file) === 'ffmpeg';
}

/**
 * Get a human-readable name for the trimmer type
 *
 * @param trimmerType - The trimmer type
 * @returns Human-readable trimmer name
 */
export function getTrimmerName(trimmerType: 'mp4box' | 'ffmpeg'): string {
  return trimmerType === 'mp4box' ? 'MP4Box' : 'FFmpeg';
}
