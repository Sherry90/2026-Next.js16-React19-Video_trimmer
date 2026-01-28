import type { VideoConstraints } from '@/types/video';

// File size thresholds (multi-tier validation)
export const FILE_SIZE = {
  RECOMMENDED_MAX: 500 * 1024 * 1024, // 500MB (권장 - 안전한 크기)
  WARNING_THRESHOLD: 1024 * 1024 * 1024, // 1GB (경고 - 처리 가능하지만 주의 필요)
  SOFT_MAX: 2 * 1024 * 1024 * 1024, // 2GB (소프트 제한 - 메모리 체크 필요)
  HARD_MAX: 5 * 1024 * 1024 * 1024, // 5GB (하드 제한 - 절대 제한)
} as const;

export const VIDEO_CONSTRAINTS: VideoConstraints = {
  maxSize: FILE_SIZE.HARD_MAX, // Use hard max for backward compatibility
  supportedFormats: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
  ],
};

export const FILE_CONSTRAINT_MESSAGES = {
  SIZE_EXCEEDED: `파일 크기가 ${FILE_SIZE.HARD_MAX / (1024 * 1024 * 1024)}GB를 초과합니다.`,
  UNSUPPORTED_FORMAT: '지원하지 않는 파일 형식입니다.',
  SIZE_WARNING: `파일이 큽니다 (권장: ${
    FILE_SIZE.RECOMMENDED_MAX / (1024 * 1024)
  }MB 이하). 처리 시간이 오래 걸리거나 메모리 부족이 발생할 수 있습니다.`,
  SIZE_CAUTION: `파일이 매우 큽니다 (${
    FILE_SIZE.SOFT_MAX / (1024 * 1024 * 1024)
  }GB 이상). 브라우저 메모리 한계로 처리에 실패할 가능성이 높습니다.`,
} as const;
