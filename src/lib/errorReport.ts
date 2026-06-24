/**
 * 서버측 구조화 에러 캡처
 *
 * 다운로더/라우트의 catch에서 원시 원인(stderr·Error)을 분류해 사용자 메시지 + 기술 상세 +
 * 정황(jobId/stage/command/exitCode/timestamp)을 담은 ServerErrorReport를 만들고, 한 줄
 * 구조화 로그로 남긴다. 클라이언트로 보낼 때는 {userMessage, code, technicalDetails}만 쓰면 된다.
 *
 * 분류·정의는 클라이언트와 동일한 단일 소스(shared/lib/errorHandler)를 재사용한다.
 */

import type { ErrorCode } from '@/types/types';
import { classifyError, getErrorDefinition } from '@/shared/lib/errorHandler';

export interface ServerErrorReport {
  code: ErrorCode;
  userMessage: string;
  solution?: string;
  /** 분류 원천이 된 기술적 원인 (stderr tail / Error.message) */
  cause: string;
  /** 실패 단계 라벨 (예: 'yt-dlp byte-range', 'ffmpeg cut', 'resolve') */
  stage: string;
  jobId?: string;
  command?: string;
  exitCode?: number | null;
  /** ISO timestamp */
  timestamp: string;
}

export interface BuildServerErrorContext {
  jobId?: string;
  command?: string;
  exitCode?: number | null;
  /** 강제 코드 지정(분류를 건너뛰고 싶을 때, 예: 검증 에러) */
  code?: ErrorCode;
}

function toCause(raw: unknown): string {
  if (raw == null) return '';
  if (raw instanceof Error) return raw.message;
  if (typeof raw === 'string') return raw;
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

/**
 * 원시 원인을 분류해 ServerErrorReport를 만든다.
 *
 * @param stage 실패 단계 라벨
 * @param rawCause stderr 문자열 또는 Error
 * @param ctx jobId/command/exitCode, 또는 강제 code
 */
export function buildServerError(
  stage: string,
  rawCause: unknown,
  ctx: BuildServerErrorContext = {}
): ServerErrorReport {
  const cause = toCause(rawCause);
  const code = ctx.code ?? classifyError(cause);
  const def = getErrorDefinition(code);
  return {
    code,
    userMessage: def.userMessage,
    solution: def.solution,
    cause,
    stage,
    jobId: ctx.jobId,
    command: ctx.command,
    exitCode: ctx.exitCode ?? null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 구조화 에러 로그 한 줄. 서버 콘솔에서 grep/파싱 가능하도록 JSON으로 남긴다.
 * cause는 길 수 있어 마지막 2KB만 보존.
 */
export function logServerError(report: ServerErrorReport): void {
  const compact = {
    ...report,
    cause: report.cause.slice(-2000),
  };
  console.error('[error-report]', JSON.stringify(compact));
}

/**
 * 빌드 + 로그를 한 번에. report를 반환하므로 호출부가 emitError/JSON 응답에 바로 쓴다.
 */
export function reportServerError(
  stage: string,
  rawCause: unknown,
  ctx: BuildServerErrorContext = {}
): ServerErrorReport {
  const report = buildServerError(stage, rawCause, ctx);
  logServerError(report);
  return report;
}
