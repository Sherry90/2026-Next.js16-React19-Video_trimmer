import type { AppError, ErrorCode } from '@/types/error';

/**
 * Parse FFmpeg error messages into user-friendly AppError
 */
export function parseFFmpegError(error: Error): AppError {
  const message = error.message.toLowerCase();

  // 메모리 부족
  if (
    message.includes('out of memory') ||
    message.includes('malloc') ||
    message.includes('memory_insufficient')
  ) {
    return {
      code: 'MEMORY_INSUFFICIENT',
      message: error.message,
      userMessage: '메모리가 부족합니다.',
      solution:
        '더 작은 파일을 사용하거나 브라우저를 재시작해주세요. 권장 파일 크기: 500MB 이하',
      technicalDetails: error.message,
    };
  }

  // 지원하지 않는 코덱
  if (
    message.includes('unknown codec') ||
    message.includes('decoder not found') ||
    message.includes('codec_unsupported')
  ) {
    return {
      code: 'CODEC_UNSUPPORTED',
      message: error.message,
      userMessage: '지원하지 않는 비디오 포맷입니다.',
      solution:
        'MP4, WebM, MOV 등 일반적인 포맷으로 변환 후 시도해주세요.',
      technicalDetails: error.message,
    };
  }

  // 파일 손상
  if (
    message.includes('invalid data') ||
    message.includes('moov atom not found') ||
    message.includes('corrupted') ||
    message.includes('file_corrupted')
  ) {
    return {
      code: 'FILE_CORRUPTED',
      message: error.message,
      userMessage: '비디오 파일이 손상되었습니다.',
      solution: '원본 파일을 확인하거나 다른 파일로 시도해주세요.',
      technicalDetails: error.message,
    };
  }

  // FFmpeg 로드 실패
  if (
    message.includes('failed to load') ||
    message.includes('ffmpeg_load_failed') ||
    message.includes('could not load ffmpeg')
  ) {
    return {
      code: 'FFMPEG_LOAD_FAILED',
      message: error.message,
      userMessage: 'FFmpeg 로드에 실패했습니다.',
      solution: '페이지를 새로고침하거나 인터넷 연결을 확인해주세요.',
      technicalDetails: error.message,
    };
  }

  // 처리 실패
  if (message.includes('video trimming failed')) {
    return {
      code: 'PROCESSING_FAILED',
      message: error.message,
      userMessage: '비디오 처리 중 오류가 발생했습니다.',
      solution: '다시 시도하거나 다른 파일을 사용해주세요.',
      technicalDetails: error.message,
    };
  }

  // 기본 에러
  return {
    code: 'UNKNOWN',
    message: error.message,
    userMessage: '알 수 없는 오류가 발생했습니다.',
    solution: '페이지를 새로고침하거나 다른 브라우저를 사용해보세요.',
    technicalDetails: error.message,
  };
}

/**
 * Create an AppError from error code
 */
export function createError(
  code: ErrorCode,
  technicalDetails?: string
): AppError {
  const errorMap: Record<ErrorCode, Omit<AppError, 'code'>> = {
    MEMORY_INSUFFICIENT: {
      message: 'Insufficient memory',
      userMessage: '메모리가 부족합니다.',
      solution:
        '더 작은 파일을 사용하거나 브라우저를 재시작해주세요. 권장 파일 크기: 500MB 이하',
      technicalDetails,
    },
    CODEC_UNSUPPORTED: {
      message: 'Unsupported codec',
      userMessage: '지원하지 않는 비디오 포맷입니다.',
      solution:
        'MP4, WebM, MOV 등 일반적인 포맷으로 변환 후 시도해주세요.',
      technicalDetails,
    },
    FILE_CORRUPTED: {
      message: 'File corrupted',
      userMessage: '비디오 파일이 손상되었습니다.',
      solution: '원본 파일을 확인하거나 다른 파일로 시도해주세요.',
      technicalDetails,
    },
    FFMPEG_LOAD_FAILED: {
      message: 'Failed to load FFmpeg',
      userMessage: 'FFmpeg 로드에 실패했습니다.',
      solution: '페이지를 새로고침하거나 인터넷 연결을 확인해주세요.',
      technicalDetails,
    },
    PROCESSING_FAILED: {
      message: 'Processing failed',
      userMessage: '비디오 처리 중 오류가 발생했습니다.',
      solution: '다시 시도하거나 다른 파일을 사용해주세요.',
      technicalDetails,
    },
    UNKNOWN: {
      message: 'Unknown error',
      userMessage: '알 수 없는 오류가 발생했습니다.',
      solution: '페이지를 새로고침하거나 다른 브라우저를 사용해보세요.',
      technicalDetails,
    },
  };

  return {
    code,
    ...errorMap[code],
  };
}
