import {
  VIDEO_CONSTRAINTS,
  FILE_CONSTRAINT_MESSAGES,
} from '@/constants/fileConstraints';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * 파일 크기 검증
 */
export function validateFileSize(file: File): FileValidationResult {
  if (file.size > VIDEO_CONSTRAINTS.maxSize) {
    return {
      isValid: false,
      error: FILE_CONSTRAINT_MESSAGES.SIZE_EXCEEDED,
    };
  }
  return { isValid: true };
}

/**
 * 파일 형식 검증
 */
export function validateFileType(file: File): FileValidationResult {
  if (!VIDEO_CONSTRAINTS.supportedFormats.includes(file.type)) {
    return {
      isValid: false,
      error: FILE_CONSTRAINT_MESSAGES.UNSUPPORTED_FORMAT,
    };
  }
  return { isValid: true };
}

/**
 * 전체 파일 검증
 */
export function validateFile(file: File): FileValidationResult {
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.isValid) {
    return sizeValidation;
  }

  const typeValidation = validateFileType(file);
  if (!typeValidation.isValid) {
    return typeValidation;
  }

  return { isValid: true };
}
