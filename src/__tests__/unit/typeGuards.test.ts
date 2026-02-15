import { describe, it, expect } from 'vitest';
import { isProcessError, toProcessError } from '@/types/process';
import { hasMemoryAPI } from '@/types/browser';

describe('Process Type Guards', () => {
  it('toProcessError should convert unknown to ProcessError', () => {
    const err = new Error('test');
    expect(toProcessError(err)).toBe(err);
    expect(toProcessError('error').message).toBe('error');
  });

  it('toProcessError should extract process error properties', () => {
    const errorObj = { code: 'ENOENT', stderr: 'output' };
    const result = toProcessError(errorObj);
    expect(result.code).toBe('ENOENT');
    expect(result.stderr).toBe('output');
  });
});

describe('Browser Type Guards', () => {
  it('hasMemoryAPI should detect memory API', () => {
    const mockPerf = {
      memory: { usedJSHeapSize: 1000, totalJSHeapSize: 2000, jsHeapSizeLimit: 3000 },
    } as unknown as Performance;
    expect(hasMemoryAPI(mockPerf)).toBe(true);
    expect(hasMemoryAPI({} as Performance)).toBe(false);
  });
});
