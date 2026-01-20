import type { VideoConstraints } from '@/types/video';

export const VIDEO_CONSTRAINTS: VideoConstraints = {
  maxSize: 1024 * 1024 * 1024, // 1GB
  supportedFormats: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
  ],
};

export const FILE_CONSTRAINT_MESSAGES = {
  SIZE_EXCEEDED: '파일 크기가 1GB를 초과합니다.',
  UNSUPPORTED_FORMAT: '지원하지 않는 파일 형식입니다.',
} as const;
