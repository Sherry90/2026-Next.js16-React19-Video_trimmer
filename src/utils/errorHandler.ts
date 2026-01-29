import type { AppError, ErrorCode } from '@/types/error';

/**
 * Single source of truth for error definitions
 * Maps error codes to user-friendly messages and solutions
 */
const ERROR_DEFINITIONS: Record<ErrorCode, Omit<AppError, 'code' | 'technicalDetails'>> = {
  MEMORY_INSUFFICIENT: {
    message: 'Insufficient memory',
    userMessage: '메모리가 부족합니다.',
    solution:
      '더 작은 파일을 사용하거나 브라우저를 재시작해주세요. 권장 파일 크기: 500MB 이하',
  },
  CODEC_UNSUPPORTED: {
    message: 'Unsupported codec',
    userMessage: '지원하지 않는 비디오 포맷입니다.',
    solution:
      'MP4, WebM, MOV 등 일반적인 포맷으로 변환 후 시도해주세요.',
  },
  FILE_CORRUPTED: {
    message: 'File corrupted',
    userMessage: '비디오 파일이 손상되었습니다.',
    solution: '원본 파일을 확인하거나 다른 파일로 시도해주세요.',
  },
  FFMPEG_LOAD_FAILED: {
    message: 'Failed to load FFmpeg',
    userMessage: 'FFmpeg 로드에 실패했습니다.',
    solution: '페이지를 새로고침하거나 인터넷 연결을 확인해주세요.',
  },
  PROCESSING_FAILED: {
    message: 'Processing failed',
    userMessage: '비디오 처리 중 오류가 발생했습니다.',
    solution: '다시 시도하거나 다른 파일을 사용해주세요.',
  },
  UNKNOWN: {
    message: 'Unknown error',
    userMessage: '알 수 없는 오류가 발생했습니다.',
    solution: '페이지를 새로고침하거나 다른 브라우저를 사용해보세요.',
  },
};

/**
 * Parse FFmpeg error messages into user-friendly AppError
 * Uses ERROR_DEFINITIONS as single source of truth
 */
export function parseFFmpegError(error: Error): AppError {
  const message = error.message.toLowerCase();

  // Detect error type from message
  let code: ErrorCode = 'UNKNOWN';

  if (
    message.includes('out of memory') ||
    message.includes('malloc') ||
    message.includes('memory_insufficient')
  ) {
    code = 'MEMORY_INSUFFICIENT';
  } else if (
    message.includes('unknown codec') ||
    message.includes('decoder not found') ||
    message.includes('codec_unsupported')
  ) {
    code = 'CODEC_UNSUPPORTED';
  } else if (
    message.includes('invalid data') ||
    message.includes('moov atom not found') ||
    message.includes('corrupted') ||
    message.includes('file_corrupted')
  ) {
    code = 'FILE_CORRUPTED';
  } else if (
    message.includes('failed to load') ||
    message.includes('ffmpeg_load_failed') ||
    message.includes('could not load ffmpeg')
  ) {
    code = 'FFMPEG_LOAD_FAILED';
  } else if (message.includes('video trimming failed')) {
    code = 'PROCESSING_FAILED';
  }

  return createError(code, error.message);
}

/**
 * Create an AppError from error code
 * Uses ERROR_DEFINITIONS as single source of truth
 */
export function createError(
  code: ErrorCode,
  technicalDetails?: string
): AppError {
  return {
    code,
    ...ERROR_DEFINITIONS[code],
    technicalDetails,
  };
}
