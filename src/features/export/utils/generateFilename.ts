/**
 * 편집된 파일명 생성
 * 예: video.mp4 -> video_edited.mp4
 */
export function generateEditedFilename(originalFilename: string): string {
  const lastDotIndex = originalFilename.lastIndexOf('.');

  if (lastDotIndex === -1) {
    return `${originalFilename}_edited`;
  }

  const nameWithoutExtension = originalFilename.substring(0, lastDotIndex);
  const extension = originalFilename.substring(lastDotIndex);

  return `${nameWithoutExtension}_edited${extension}`;
}
