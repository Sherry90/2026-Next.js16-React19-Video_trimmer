import {
  VIDEO_CONSTRAINTS,
  FILE_CONSTRAINT_MESSAGES,
  FILE_SIZE,
} from '@/constants/fileConstraints';
import {
  checkMemoryAvailability,
  getMemoryStatusMessage,
} from '@/utils/memoryMonitor';

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  warning?: string; // 경고 메시지 (처리는 허용)
}

/**
 * 파일 크기 검증 (다층 검증: 권장/경고/제한)
 */
export function validateFileSize(file: File): FileValidationResult {
  // 하드 제한 초과 - 거부
  if (file.size > FILE_SIZE.HARD_MAX) {
    return {
      isValid: false,
      error: FILE_CONSTRAINT_MESSAGES.SIZE_EXCEEDED,
    };
  }

  // 소프트 제한 초과 - 메모리 체크 후 경고
  if (file.size > FILE_SIZE.SOFT_MAX) {
    const memoryWarning = getMemoryStatusMessage(file.size);
    if (!checkMemoryAvailability(file.size)) {
      return {
        isValid: false,
        error:
          memoryWarning ||
          '파일이 너무 커서 브라우저 메모리가 부족할 수 있습니다. 더 작은 파일을 사용해주세요.',
      };
    }
    return {
      isValid: true,
      warning: FILE_CONSTRAINT_MESSAGES.SIZE_CAUTION,
    };
  }

  // 경고 임계값 초과 - 경고만 표시
  if (file.size > FILE_SIZE.WARNING_THRESHOLD) {
    return {
      isValid: true,
      warning: FILE_CONSTRAINT_MESSAGES.SIZE_WARNING,
    };
  }

  // 권장 크기 이하 - 문제 없음
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
  // Type validation first (hard error)
  const typeValidation = validateFileType(file);
  if (!typeValidation.isValid) {
    return typeValidation;
  }

  // Size validation (may return warning)
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.isValid) {
    return sizeValidation;
  }

  // If size validation passed but has warning, return it
  if (sizeValidation.warning) {
    return {
      isValid: true,
      warning: sizeValidation.warning,
    };
  }

  return { isValid: true };
}
