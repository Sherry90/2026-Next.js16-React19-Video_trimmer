import { describe, it, expect } from 'vitest';
import {
  validateFile,
  validateFileSize,
  validateFileType,
} from '@/features/upload/utils/validateFile';
import { FILE_CONSTRAINT_MESSAGES } from '@/constants/fileConstraints';

describe('validateFile', () => {
  describe('validateFileSize', () => {
    it('should accept file under 1GB', () => {
      const file = new File(['test'], 'test.mp4', {
        type: 'video/mp4',
      });
      Object.defineProperty(file, 'size', { value: 500 * 1024 * 1024 }); // 500MB

      const result = validateFileSize(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept file exactly 1GB', () => {
      const file = new File(['test'], 'test.mp4', {
        type: 'video/mp4',
      });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 * 1024 }); // 1GB

      const result = validateFileSize(file);
      expect(result.isValid).toBe(true);
    });

    it('should reject file over 1GB', () => {
      const file = new File(['test'], 'test.mp4', {
        type: 'video/mp4',
      });
      Object.defineProperty(file, 'size', { value: 1024 * 1024 * 1024 + 1 }); // 1GB + 1 byte

      const result = validateFileSize(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(FILE_CONSTRAINT_MESSAGES.SIZE_EXCEEDED);
    });

    it('should accept zero size file', () => {
      const file = new File([''], 'test.mp4', {
        type: 'video/mp4',
      });

      const result = validateFileSize(file);
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateFileType', () => {
    it('should accept mp4 format', () => {
      const file = new File(['test'], 'test.mp4', {
        type: 'video/mp4',
      });

      const result = validateFileType(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept webm format', () => {
      const file = new File(['test'], 'test.webm', {
        type: 'video/webm',
      });

      const result = validateFileType(file);
      expect(result.isValid).toBe(true);
    });

    it('should accept ogg format', () => {
      const file = new File(['test'], 'test.ogg', {
        type: 'video/ogg',
      });

      const result = validateFileType(file);
      expect(result.isValid).toBe(true);
    });

    it('should accept quicktime format', () => {
      const file = new File(['test'], 'test.mov', {
        type: 'video/quicktime',
      });

      const result = validateFileType(file);
      expect(result.isValid).toBe(true);
    });

    it('should accept avi format', () => {
      const file = new File(['test'], 'test.avi', {
        type: 'video/x-msvideo',
      });

      const result = validateFileType(file);
      expect(result.isValid).toBe(true);
    });

    it('should accept mkv format', () => {
      const file = new File(['test'], 'test.mkv', {
        type: 'video/x-matroska',
      });

      const result = validateFileType(file);
      expect(result.isValid).toBe(true);
    });

    it('should reject unsupported format', () => {
      const file = new File(['test'], 'test.txt', {
        type: 'text/plain',
      });

      const result = validateFileType(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(FILE_CONSTRAINT_MESSAGES.UNSUPPORTED_FORMAT);
    });

    it('should reject image format', () => {
      const file = new File(['test'], 'test.jpg', {
        type: 'image/jpeg',
      });

      const result = validateFileType(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(FILE_CONSTRAINT_MESSAGES.UNSUPPORTED_FORMAT);
    });
  });

  describe('validateFile', () => {
    it('should accept valid file', () => {
      const file = new File(['test'], 'test.mp4', {
        type: 'video/mp4',
      });
      Object.defineProperty(file, 'size', { value: 500 * 1024 * 1024 });

      const result = validateFile(file);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject file with invalid size', () => {
      const file = new File(['test'], 'test.mp4', {
        type: 'video/mp4',
      });
      Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 * 1024 }); // 2GB

      const result = validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(FILE_CONSTRAINT_MESSAGES.SIZE_EXCEEDED);
    });

    it('should reject file with invalid type', () => {
      const file = new File(['test'], 'test.txt', {
        type: 'text/plain',
      });
      Object.defineProperty(file, 'size', { value: 500 * 1024 * 1024 });

      const result = validateFile(file);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(FILE_CONSTRAINT_MESSAGES.UNSUPPORTED_FORMAT);
    });

    it('should reject file with both invalid size and type', () => {
      const file = new File(['test'], 'test.txt', {
        type: 'text/plain',
      });
      Object.defineProperty(file, 'size', { value: 2 * 1024 * 1024 * 1024 });

      const result = validateFile(file);
      expect(result.isValid).toBe(false);
      // Should return size error first
      expect(result.error).toBe(FILE_CONSTRAINT_MESSAGES.SIZE_EXCEEDED);
    });
  });
});
