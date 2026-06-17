import { ChildProcess } from 'child_process';

/**
 * 프로세스 + 그 자식까지(프로세스 그룹) 죽인다.
 *
 * yt-dlp가 aria2c를 외부 다운로더로 spawn하면 aria2c는 yt-dlp의 자식이라,
 * yt-dlp만 kill하면 aria2c가 고아로 남아 계속 돌며 서버를 잡아먹는다.
 * `spawn(..., { detached: true })`로 띄운 프로세스는 자기 PID가 곧 프로세스 그룹 ID라
 * `process.kill(-pid, signal)`로 그룹 전체(자식 aria2c 포함)를 한 번에 정리한다.
 */
export function killProcessTree(proc: ChildProcess, signal: NodeJS.Signals = 'SIGKILL'): void {
  if (!proc.pid) return;
  try {
    process.kill(-proc.pid, signal); // 음수 pid = 프로세스 그룹 전체
  } catch {
    try { proc.kill(signal); } catch { /* 이미 종료됨 */ }
  }
}

/**
 * stall watchdog. 마지막 활동(getLastActivity) 이후 timeoutMs 동안 진행이 전혀 없으면
 * hang으로 보고 onStall을 호출한다. checkIntervalMs마다 폴링. stop()으로 타이머 정리,
 * stalled()로 발동 여부 조회. (다운로드는 디스크 직행 스트리밍이라 절대 시간 제한 대신 이걸 쓴다.)
 */
export function watchStall(opts: {
  getLastActivity: () => number;
  timeoutMs: number;
  checkIntervalMs: number;
  onStall: () => void;
}): { stop: () => void; stalled: () => boolean } {
  let stalled = false;
  const timer = setInterval(() => {
    if (Date.now() - opts.getLastActivity() > opts.timeoutMs) {
      stalled = true;
      opts.onStall();
    }
  }, opts.checkIntervalMs);
  return {
    stop: () => clearInterval(timer),
    stalled: () => stalled,
  };
}

/**
 * 타임아웃이 있는 프로세스 실행 옵션
 */
export interface ProcessTimeoutOptions {
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Log prefix for debugging messages */
  logPrefix: string;
  /** Success condition check (receives exit code and stderr) */
  onSuccess: (exitCode: number | null, stderr: string) => boolean;
}

/**
 * 타임아웃이 있는 프로세스 실행 래퍼
 *
 * stderr 수집, 타임아웃 처리, 성공/실패 판정을 자동화
 *
 * @param proc - Child process
 * @param timeoutMsOrOptions - Timeout in ms (simple mode) or configuration options (advanced mode).
 *   `timeoutMs <= 0`이면 절대 타임아웃 없음(close/error로만 종료) — 호출부가 stall watchdog 등
 *   다른 종료 조건을 직접 관리할 때 사용.
 * @returns Promise<boolean> - true if successful
 *
 * @example
 * Simple mode (assumes success on exit code 0):
 * ```typescript
 * const proc = spawn('command', ['args']);
 * const success = await runWithTimeout(proc, 60000);
 * ```
 *
 * Advanced mode (custom success check):
 * ```typescript
 * const proc = spawn('command', ['args']);
 * const success = await runWithTimeout(proc, {
 *   timeoutMs: 60000,
 *   logPrefix: '[job]',
 *   onSuccess: (code) => code === 0
 * });
 * ```
 */
export function runWithTimeout(
  proc: ChildProcess,
  timeoutMsOrOptions: number | ProcessTimeoutOptions
): Promise<boolean> {
  // Convert simple timeout to full options
  const options: ProcessTimeoutOptions =
    typeof timeoutMsOrOptions === 'number'
      ? {
          timeoutMs: timeoutMsOrOptions,
          logPrefix: '[Process]',
          onSuccess: (code) => code === 0,
        }
      : timeoutMsOrOptions;

  const { timeoutMs, logPrefix, onSuccess } = options;

  return new Promise((resolve) => {
    let stderr = '';
    let settled = false;

    const settle = (result: boolean, reason: string) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
        resolve(result);
    };

    // stderr를 무제한 누적하면 장시간 다운로드(yt-dlp/ffmpeg progress 폭주)에서
    // 문자열이 GB까지 자라 Node 힙 OOM이 난다. 진단엔 마지막 50KB면 충분하므로 tail만 보존.
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-50_000);
    });

    proc.on('error', (err) => {
      console.log(`${logPrefix} process error:`, err.message);
      settle(false, `process error: ${err.message}`);
    });

    proc.on('close', (code) => {
      if (onSuccess(code, stderr)) {
        settle(true, `exit code ${code}`);
      } else {
        console.log(
          `${logPrefix} exited with code ${code}:`,
          stderr.slice(0, 300)
        );
        settle(false, `exit code ${code}`);
      }
    });

    // Timeout (timeoutMs <= 0 이면 절대 타임아웃 없음 — 호출부가 stall 등으로 종료 관리)
    const timeout =
      timeoutMs > 0
        ? setTimeout(() => {
            console.log(`${logPrefix} timed out after ${timeoutMs}ms`);
            proc.kill('SIGKILL');
            settle(false, 'timeout');
          }, timeoutMs)
        : null;
  });
}
