import { NextResponse } from 'next/server';

/**
 * yt-dlp 명령 에러 파싱
 *
 * yt-dlp 실행 시 발생하는 일반적인 에러를 파싱하여
 * 사용자 친화적인 메시지와 적절한 HTTP 상태 코드를 반환
 *
 * @param error - yt-dlp 실행 에러 객체
 * @returns 에러 메시지와 HTTP 상태 코드
 */
export function parseYtdlpError(error: any): {
  message: string;
  status: number;
} {
  // yt-dlp 바이너리를 찾을 수 없는 경우
  if (error.code === 'ENOENT') {
    return {
      message:
        'yt-dlp가 설치되어 있지 않습니다. `brew install yt-dlp`로 설치해주세요.',
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
