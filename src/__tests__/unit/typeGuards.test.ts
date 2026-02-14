import { describe, it, expect } from 'vitest';
import { isProcessError, toProcessError } from '@/types/process';
import { hasMemoryAPI } from '@/types/browser';

describe('Process Type Guards', () => {
  describe('isProcessError', () => {
    it('should return true for Error instances', () => {
      expect(isProcessError(new Error('test'))).toBe(true);
      expect(isProcessError(new TypeError('test'))).toBe(true);
    });

    it('should return false for non-Error values', () => {
      expect(isProcessError('error')).toBe(false);
      expect(isProcessError(null)).toBe(false);
      expect(isProcessError(undefined)).toBe(false);
      expect(isProcessError({})).toBe(false);
      expect(isProcessError(123)).toBe(false);
    });
  });

  describe('toProcessError', () => {
    it('should return Error as-is', () => {
      const err = new Error('test error');
      const result = toProcessError(err);
      expect(result).toBe(err);
      expect(result.message).toBe('test error');
    });

    it('should convert string to Error', () => {
      const result = toProcessError('test error');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('test error');
    });

    it('should extract process error properties', () => {
      const errorObj = {
        message: 'Process failed',
        code: 'ENOENT',
        stderr: 'stderr output',
        exitCode: 1,
      };
      const result = toProcessError(errorObj);
      expect(result).toBeInstanceOf(Error);
      expect(result.code).toBe('ENOENT');
      expect(result.stderr).toBe('stderr output');
      expect(result.exitCode).toBe(1);
    });

    it('should handle null and undefined', () => {
      expect(toProcessError(null).message).toBe('null');
      expect(toProcessError(undefined).message).toBe('undefined');
    });

    it('should convert number to Error', () => {
      const result = toProcessError(123);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('123');
    });

    it('should ignore non-string/number properties', () => {
      const errorObj = {
        code: 123, // wrong type
        stderr: true, // wrong type
        exitCode: 'wrong', // wrong type
      };
      const result = toProcessError(errorObj);
      expect(result.code).toBeUndefined();
      expect(result.stderr).toBeUndefined();
      expect(result.exitCode).toBeUndefined();
    });
  });
});

describe('Browser Type Guards', () => {
  describe('hasMemoryAPI', () => {
    it('should return true for performance with valid memory object', () => {
      const mockPerformance = {
        memory: {
          usedJSHeapSize: 1000000,
          totalJSHeapSize: 2000000,
          jsHeapSizeLimit: 3000000,
        },
      } as unknown as Performance;

      expect(hasMemoryAPI(mockPerformance)).toBe(true);
    });

    it('should return false for performance without memory', () => {
      const mockPerformance = {} as Performance;
      expect(hasMemoryAPI(mockPerformance)).toBe(false);
    });

    it('should return false for performance with undefined memory', () => {
      const mockPerformance = {
        memory: undefined,
      } as unknown as Performance;
      expect(hasMemoryAPI(mockPerformance)).toBe(false);
    });

    it('should return false for performance with invalid memory object', () => {
      const mockPerformance = {
        memory: {
          usedJSHeapSize: 'invalid', // wrong type
        },
      } as unknown as Performance;
      expect(hasMemoryAPI(mockPerformance)).toBe(false);
    });
  });
});
