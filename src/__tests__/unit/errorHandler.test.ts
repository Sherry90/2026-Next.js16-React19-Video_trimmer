import { describe, it, expect } from 'vitest';
import { parseFFmpegError, createError } from '@/shared/lib/errorHandler';

describe('parseFFmpegError', () => {
  it('메모리 부족 감지', () => {
    expect(parseFFmpegError(new Error('Out of memory')).code).toBe('MEMORY_INSUFFICIENT');
    expect(parseFFmpegError(new Error('malloc failed')).code).toBe('MEMORY_INSUFFICIENT');
  });

  it('코덱 미지원 감지', () => {
    expect(parseFFmpegError(new Error('Unknown codec foo')).code).toBe('CODEC_UNSUPPORTED');
    expect(parseFFmpegError(new Error('decoder not found')).code).toBe('CODEC_UNSUPPORTED');
  });

  it('파일 손상 감지', () => {
    expect(parseFFmpegError(new Error('moov atom not found')).code).toBe('FILE_CORRUPTED');
    expect(parseFFmpegError(new Error('Invalid data found')).code).toBe('FILE_CORRUPTED');
  });

  it('FFmpeg 로드 실패 감지', () => {
    expect(parseFFmpegError(new Error('Failed to load core')).code).toBe('FFMPEG_LOAD_FAILED');
  });

  it('처리 실패 감지', () => {
    expect(parseFFmpegError(new Error('Video trimming failed')).code).toBe('PROCESSING_FAILED');
  });

  it('미분류는 UNKNOWN', () => {
    expect(parseFFmpegError(new Error('something weird')).code).toBe('UNKNOWN');
  });

  it('원본 메시지를 technicalDetails로 보존', () => {
    const err = parseFFmpegError(new Error('Out of memory at 0x1234'));
    expect(err.technicalDetails).toBe('Out of memory at 0x1234');
    expect(err.userMessage).toBe('메모리가 부족합니다.');
  });
});

describe('createError', () => {
  it('코드 정의의 message/userMessage/solution 채움', () => {
    const err = createError('CODEC_UNSUPPORTED', 'detail');
    expect(err.code).toBe('CODEC_UNSUPPORTED');
    expect(err.message).toBe('Unsupported codec');
    expect(err.userMessage).toBe('지원하지 않는 비디오 포맷입니다.');
    expect(err.solution).toContain('MP4');
    expect(err.technicalDetails).toBe('detail');
  });
});
