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
 * @param options - Configuration options
 * @returns Promise<boolean> - true if successful
 *
 * @example
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
  options: ProcessTimeoutOptions
): Promise<boolean> {
  const { timeoutMs, logPrefix, onSuccess } = options;

  return new Promise((resolve) => {
    let stderr = '';

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', (err) => {
      console.log(`${logPrefix} process error:`, err.message);
      resolve(false);
    });

    proc.on('close', (code) => {
      if (onSuccess(code, stderr)) {
        console.log(`${logPrefix} succeeded`);
        resolve(true);
      } else {
        console.log(
          `${logPrefix} exited with code ${code}:`,
          stderr.slice(0, 300)
        );
        resolve(false);
      }
    });

    // Timeout
    const timeout = setTimeout(() => {
      console.log(`${logPrefix} timed out after ${timeoutMs}ms`);
      killProcess(proc);
      resolve(false);
    }, timeoutMs);

    proc.on('close', () => clearTimeout(timeout));
  });
}
