import { ChildProcess } from 'child_process';

/**
 * 프로세스를 안전하게 종료
 */
export function killProcess(proc: ChildProcess): void {
  try {
    if (proc.pid && !proc.killed) {
      proc.kill('SIGTERM');
    }
  } catch {
    /* ignore */
  }
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
 * @param timeoutMsOrOptions - Timeout in ms (simple mode) or configuration options (advanced mode)
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

    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(result);
    };

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      console.log(`${logPrefix} process error:`, err.message);
      settle(false);
    });

    proc.on('close', (code) => {
      if (onSuccess(code, stderr)) {
        console.log(`${logPrefix} succeeded`);
        settle(true);
      } else {
        console.log(
          `${logPrefix} exited with code ${code}:`,
          stderr.slice(0, 300)
        );
        settle(false);
      }
    });

    // Timeout
    const timeout = setTimeout(() => {
      console.log(`${logPrefix} timed out after ${timeoutMs}ms`);
      proc.kill('SIGKILL');
      settle(false);
    }, timeoutMs);
  });
}
