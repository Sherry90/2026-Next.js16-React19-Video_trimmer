import type { VideoConstraints } from '@/types/types';

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
    // Core formats
    'video/mp4',
    'video/webm',
    'video/ogg',

    // Apple/QuickTime
    'video/quicktime', // .mov
    'video/x-m4v', // .m4v

    // Microsoft/Windows
    'video/x-msvideo', // .avi
    'video/x-ms-wmv', // .wmv

    // Matroska/MKV
    'video/x-matroska', // .mkv

    // Streaming/Mobile
    'video/x-flv', // .flv
    'video/mp2t', // .ts (MPEG Transport Stream)
    'video/3gpp', // .3gp
    'video/3gpp2', // .3g2

    // Additional MPEG variants
    'video/mpeg', // .mpeg, .mpg
  ],
};

// Supported file extensions (for display/documentation)
export const SUPPORTED_EXTENSIONS = [
  '.mp4',
  '.webm',
  '.ogg',
  '.mov',
  '.m4v',
  '.avi',
  '.wmv',
  '.mkv',
  '.flv',
  '.ts',
  '.3gp',
  '.3g2',
  '.mpeg',
  '.mpg',
] as const;

// 원초 상수 (리터럴 값만 사용)
const HARD_MAX_GB = 5;
const RECOMMENDED_MAX_MB = 500;
const SOFT_MAX_GB = 2;

/**
 * 파일 제약 메시지 생성 함수
 * Note: 원초성(primitivity) 확보를 위해 함수로 분리
 */
export function getConstraintMessages() {
  return {
    SIZE_EXCEEDED: `파일 크기가 ${HARD_MAX_GB}GB를 초과합니다.`,
    UNSUPPORTED_FORMAT: `지원하지 않는 파일 형식입니다. 지원 형식: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    SIZE_WARNING: `파일이 큽니다 (권장: ${RECOMMENDED_MAX_MB}MB 이하). 처리 시간이 오래 걸리거나 메모리 부족이 발생할 수 있습니다.`,
    SIZE_CAUTION: `파일이 매우 큽니다 (${SOFT_MAX_GB}GB 이상). 브라우저 메모리 한계로 처리에 실패할 가능성이 높습니다.`,
  } as const;
}

// 하위 호환성을 위한 즉시 실행
export const FILE_CONSTRAINT_MESSAGES = getConstraintMessages();
