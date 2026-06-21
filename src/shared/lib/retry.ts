/**
 * 비동기 작업 재시도 유틸 (네트워크/연산 일시 실패용).
 *
 * - 첫 시도 실패 시 최대 `retries`회 추가 재시도(기본 3 → 총 4회).
 * - abort(취소)는 종료로 간주: 재시도하지 않고 즉시 throw.
 *   (새 URL 진입 등으로 이전 요청이 abort되면 낭비 재시도/스테일 결과 방지.)
 * - 시도 간 선형 백오프(`delayMs * 시도횟수`). 백오프 sleep도 abort 가능.
 *
 * 영구 실패(형식 오류 등)는 일시 실패와 구분하지 않으므로 호출자는 재시도가
 * 무의미한 경로(예: 결정적 'no audio')에는 적용하지 말 것.
 */

export interface RetryOptions {
  /** 추가 재시도 횟수(첫 시도 제외). 기본 3. */
  retries?: number;
  /** 취소 시그널. aborted면 재시도 중단하고 throw. */
  signal?: AbortSignal;
  /** 시도 간 기본 지연(ms). 선형 증가. 기본 300. */
  delayMs?: number;
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 3, signal, delayMs = 300 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // abort는 종료 — 재시도 안 함
      if (signal?.aborted || isAbortError(err)) throw err;
      if (attempt < retries) {
        await sleep(delayMs * (attempt + 1), signal);
      }
    }
  }

  throw lastError;
}
