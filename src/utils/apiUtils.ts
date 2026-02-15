import { NextResponse } from 'next/server';
import type { ProcessError } from '@/types/process';

/**
 * yt-dlp 명령 에러 파싱
 *
 * yt-dlp 실행 시 발생하는 일반적인 에러를 파싱하여
 * 사용자 친화적인 메시지와 적절한 HTTP 상태 코드를 반환
 *
 * @param error - yt-dlp 실행 에러 객체
 * @returns 에러 메시지와 HTTP 상태 코드
 */
export function parseYtdlpError(error: ProcessError): {
  message: string;
  status: number;
} {
  // yt-dlp 바이너리를 찾을 수 없는 경우
  if (error.code === 'ENOENT') {
    return {
      message:
        '영상 처리 도구(yt-dlp)를 찾을 수 없습니다. 앱이 올바르게 설치되지 않았을 수 있습니다.',
      status: 500,
    };
  }

  // 타임아웃으로 프로세스가 강제 종료된 경우
  if (error.killed) {
    return {
      message: '요청 시간이 초과되었습니다',
      status: 504,
    };
  }

  // stderr에서 특정 에러 패턴 확인
  const stderr = error.stderr || '';
  if (stderr.includes('Unsupported URL')) {
    return {
      message: '지원하지 않는 URL입니다',
      status: 400,
    };
  }

  // 기본 에러 (원인 불명)
  return {
    message: '영상 정보를 가져올 수 없습니다',
    status: 500,
  };
}

/**
 * 표준 API 에러 응답 생성
 *
 * 일반적인 API 에러를 로깅하고 표준화된 JSON 응답 반환
 *
 * @param error - 에러 객체
 * @param context - 에러 발생 컨텍스트 (로그용)
 * @param defaultMessage - 사용자에게 표시할 에러 메시지
 * @param status - HTTP 상태 코드 (기본: 500)
 * @returns NextResponse with error JSON
 *
 * @example
 * ```typescript
 * try {
 *   // ... some operation
 * } catch (error) {
 *   return handleApiError(error, 'trim', '트리밍 처리 중 오류가 발생했습니다');
 * }
 * ```
 */
export function handleApiError(
  error: unknown,
  context: string,
  defaultMessage: string = '요청 처리 중 오류가 발생했습니다',
  status: number = 500
): NextResponse {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(`[${context}] Error:`, msg);

  return NextResponse.json({ error: defaultMessage }, { status });
}

/**
 * 유효성 검증 에러 응답 생성 헬퍼
 */
export function createValidationError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Trim 요청 파라미터
 */
export interface TrimRequestParams {
  originalUrl: string;
  startTime: number;
  endTime: number;
  filename?: string;
}

/**
 * Trim 요청 검증
 *
 * @param body - 요청 본문
 * @returns 검증 결과 (성공 시 파싱된 데이터, 실패 시 에러 정보)
 */
export function validateTrimRequest(
  body: unknown
):
  | { valid: true; data: TrimRequestParams }
  | { valid: false; error: string; status: number } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: '유효하지 않은 요청입니다', status: 400 };
  }
  const { originalUrl, startTime, endTime, filename } = body as Record<string, unknown>;

  if (!originalUrl || typeof originalUrl !== 'string' || !originalUrl.trim()) {
    return { valid: false, error: '유효하지 않은 URL입니다', status: 400 };
  }

  if (typeof startTime !== 'number' || startTime < 0) {
    return { valid: false, error: '유효하지 않은 시작 시간입니다', status: 400 };
  }

  if (typeof endTime !== 'number' || endTime <= startTime) {
    return { valid: false, error: '종료 시간은 시작 시간보다 커야 합니다', status: 400 };
  }

  return {
    valid: true,
    data: {
      originalUrl: originalUrl.trim(),
      startTime,
      endTime,
      filename: typeof filename === 'string' ? filename : undefined,
    },
  };
}

/**
 * Download 요청 파라미터
 */
export interface DownloadRequestParams {
  url: string;
  startTime: number;
  endTime: number;
  filename: string;
  tbr?: number;
}

/**
 * Download 요청 검증
 *
 * @param body - 요청 본문
 * @returns 검증 결과 (성공 시 파싱된 데이터, 실패 시 에러 정보)
 */
export function validateDownloadRequest(
  body: unknown
):
  | { valid: true; data: DownloadRequestParams }
  | { valid: false; error: string; status: number } {
  if (typeof body !== 'object' || body === null) {
    return { valid: false, error: '유효하지 않은 요청입니다', status: 400 };
  }
  const { url, startTime, endTime, filename, tbr } = body as Record<string, unknown>;

  if (!url || typeof url !== 'string' || !url.trim()) {
    return { valid: false, error: '유효하지 않은 URL입니다', status: 400 };
  }

  if (typeof startTime !== 'number' || startTime < 0) {
    return { valid: false, error: '유효하지 않은 시작 시간입니다', status: 400 };
  }

  if (typeof endTime !== 'number' || endTime <= startTime) {
    return { valid: false, error: '종료 시간은 시작 시간보다 커야 합니다', status: 400 };
  }

  if (!filename || typeof filename !== 'string') {
    return { valid: false, error: '파일명이 필요합니다', status: 400 };
  }

  return {
    valid: true,
    data: {
      url: url.trim(),
      startTime,
      endTime,
      filename,
      tbr: typeof tbr === 'number' ? tbr : undefined,
    },
  };
}
