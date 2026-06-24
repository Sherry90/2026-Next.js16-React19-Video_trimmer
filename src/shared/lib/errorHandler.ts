import type { AppError, ErrorCode, ErrorContext } from '@/types/types';

/**
 * Single source of truth for error definitions
 * Maps error codes to user-friendly messages and solutions.
 *
 * 서버·클라이언트 공용(순수 TS, React 의존 없음) — 다운로드/네트워크/바이너리 에러도
 * 여기서 분류·해결책을 단일 관리한다.
 */
const ERROR_DEFINITIONS: Record<ErrorCode, Omit<AppError, 'code' | 'technicalDetails' | 'context'>> = {
  MEMORY_INSUFFICIENT: {
    message: 'Insufficient memory',
    userMessage: '메모리가 부족합니다.',
    solution:
      '더 작은 파일을 사용하거나 브라우저를 재시작해주세요. 권장 파일 크기: 500MB 이하',
  },
  CODEC_UNSUPPORTED: {
    message: 'Unsupported codec',
    userMessage: '지원하지 않는 비디오 포맷입니다.',
    solution: 'MP4, WebM, MOV 등 일반적인 포맷으로 변환 후 시도해주세요.',
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
  NETWORK_ERROR: {
    message: 'Network error',
    userMessage: '네트워크 연결에 문제가 발생했습니다.',
    solution: '인터넷 연결을 확인하고 다시 시도해주세요. 서버가 실행 중인지도 확인해주세요.',
  },
  DOWNLOAD_ERROR: {
    message: 'Download failed',
    userMessage: '영상 다운로드에 실패했습니다.',
    solution: '잠시 후 다시 시도하거나, 다른 화질/구간으로 시도해주세요. 상세 정보를 확인하면 원인을 알 수 있습니다.',
  },
  VIDEO_UNAVAILABLE: {
    message: 'Video unavailable',
    userMessage: '영상을 가져올 수 없습니다 (비공개·삭제·지역 제한 등).',
    solution: '영상이 공개 상태인지, 로그인이 필요한지, 지역 제한이 없는지 확인해주세요.',
  },
  BINARY_MISSING: {
    message: 'Required binary not found',
    userMessage: '필수 실행 파일을 찾을 수 없습니다 (yt-dlp/ffmpeg/streamlink/aria2c).',
    solution: '`npm install`을 다시 실행해 의존성 바이너리를 설치하세요(postinstall). 설치 로그를 확인해주세요.',
  },
  TIMEOUT: {
    message: 'Operation timed out',
    userMessage: '작업이 시간 초과되었습니다.',
    solution: '네트워크가 느리거나 서버가 응답하지 않습니다. 잠시 후 다시 시도해주세요.',
  },
  VALIDATION_ERROR: {
    message: 'Validation error',
    userMessage: '입력값이 올바르지 않습니다.',
    solution: 'URL/구간 등 입력을 확인하고 다시 시도해주세요.',
  },
  EXPORT_ERROR: {
    message: 'Export failed',
    userMessage: '내보내기에 실패했습니다.',
    solution: '다시 시도하거나 다른 구간/파일로 시도해주세요.',
  },
  SERVER_ERROR: {
    message: 'Server error',
    userMessage: '서버 처리 중 오류가 발생했습니다.',
    solution: '잠시 후 다시 시도해주세요. 반복되면 상세 정보를 첨부해 문의해주세요.',
  },
  UNKNOWN: {
    message: 'Unknown error',
    userMessage: '알 수 없는 오류가 발생했습니다.',
    solution: '페이지를 새로고침하거나 다른 브라우저를 사용해보세요.',
  },
};

/** code → 정의 조회 (단일 소스). 잘못된 code는 UNKNOWN으로 폴백. */
export function getErrorDefinition(code: ErrorCode) {
  return ERROR_DEFINITIONS[code] ?? ERROR_DEFINITIONS.UNKNOWN;
}

/** code가 유효한 ErrorCode인지 검사 (store의 free-string 방어용) */
export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERROR_DEFINITIONS;
}

/**
 * 원시 에러 메시지/스택/stderr에서 에러 코드를 분류한다.
 *
 * 서버 다운로더(yt-dlp/ffmpeg/streamlink) stderr, fetch 실패, 프로세스 ENOENT 등
 * 다양한 원천을 하나의 시그널 매칭으로 일반화한다. 순서가 중요(구체적인 것 먼저).
 */
export function classifyError(raw: string): ErrorCode {
  const m = (raw || '').toLowerCase();
  if (!m) return 'UNKNOWN';

  // 영상 접근 불가 (비공개/삭제/지역/로그인/403)
  if (
    /\b40[13]\b|forbidden|private video|this video is private|video unavailable|not available|sign in to confirm|members-only|geo|age.?restricted|removed by the uploader/.test(m)
  ) {
    return 'VIDEO_UNAVAILABLE';
  }
  // 실행 파일 없음
  if (
    /enoent|command not found|no such file|설치되어 있지 않|not installed|executable not found|cannot find .*(yt-dlp|ffmpeg|streamlink|aria2)/.test(m)
  ) {
    return 'BINARY_MISSING';
  }
  // 타임아웃/정체
  if (/timed out|timeout|stall|etimedout|exceeded max/.test(m)) {
    return 'TIMEOUT';
  }
  // 메모리
  if (/out of memory|oom|malloc|memory_insufficient|allocation failed/.test(m)) {
    return 'MEMORY_INSUFFICIENT';
  }
  // 코덱
  if (/unknown codec|decoder not found|codec_unsupported|unsupported codec/.test(m)) {
    return 'CODEC_UNSUPPORTED';
  }
  // 손상 파일
  if (/moov atom not found|invalid data found|corrupted|file_corrupted|malformed/.test(m)) {
    return 'FILE_CORRUPTED';
  }
  // FFmpeg 로드 실패 (wasm)
  if (/failed to load|ffmpeg_load_failed|could not load ffmpeg/.test(m)) {
    return 'FFMPEG_LOAD_FAILED';
  }
  // 네트워크 (구체 시그널 뒤에 둬 403 등이 먼저 잡히게)
  if (
    /econnrefused|econnreset|enotfound|fetch failed|network|연결할 수 없|connection (refused|reset|lost)|socket hang up|getaddrinfo/.test(m)
  ) {
    return 'NETWORK_ERROR';
  }
  // 다운로드 일반
  if (/download|yt-dlp|aria2|streamlink|fragment|hls/.test(m)) {
    return 'DOWNLOAD_ERROR';
  }
  return 'UNKNOWN';
}

/**
 * Create an AppError from error code (single source of truth)
 */
export function createError(
  code: ErrorCode,
  technicalDetails?: string,
  context?: ErrorContext
): AppError {
  return {
    code,
    ...getErrorDefinition(code),
    technicalDetails,
    context,
  };
}

/**
 * 임의 원시 에러(Error|string|unknown)를 분류해 AppError로 만든다.
 * 미분류(UNKNOWN)는 fallbackCode로 대체 — 호출 맥락에 맞는 기본 코드를 준다.
 */
export function errorFromRaw(raw: unknown, fallbackCode: ErrorCode = 'UNKNOWN'): AppError {
  const message = raw instanceof Error ? raw.message : String(raw);
  const code = classifyError(message);
  return createError(code === 'UNKNOWN' ? fallbackCode : code, message);
}

/**
 * Parse FFmpeg/일반 에러를 분류해 AppError로. 미분류는 PROCESSING_FAILED(export 맥락).
 */
export function parseFFmpegError(error: Error): AppError {
  return errorFromRaw(error, 'PROCESSING_FAILED');
}

/**
 * 복사 가능한 에러 리포트 텍스트를 만든다 (버그 공유·원인 추적용).
 * code/메시지/해결책/정황/기술상세를 한 덩어리로 직렬화.
 */
export function formatErrorReport(error: AppError): string {
  const ts = error.context?.timestamp ?? '';
  const lines = [
    '=== Video Trimmer Error Report ===',
    `code: ${error.code}`,
    `message: ${error.userMessage}`,
  ];
  if (error.solution) lines.push(`solution: ${error.solution}`);
  if (error.context?.stage) lines.push(`stage: ${error.context.stage}`);
  if (error.context?.jobId) lines.push(`jobId: ${error.context.jobId}`);
  if (error.context?.command) lines.push(`command: ${error.context.command}`);
  if (error.context?.exitCode !== undefined && error.context?.exitCode !== null) {
    lines.push(`exitCode: ${error.context.exitCode}`);
  }
  if (ts) lines.push(`timestamp: ${ts}`);
  if (typeof navigator !== 'undefined') {
    lines.push(`userAgent: ${navigator.userAgent}`);
    if (typeof location !== 'undefined') lines.push(`url: ${location.href}`);
  }
  if (error.technicalDetails) {
    lines.push('--- technical details ---', error.technicalDetails);
  }
  return lines.join('\n');
}
