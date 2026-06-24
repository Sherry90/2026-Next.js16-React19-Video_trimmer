import { describe, it, expect } from 'vitest';
import {
  parseFFmpegError,
  createError,
  classifyError,
  formatErrorReport,
  isErrorCode,
  getErrorDefinition,
} from '@/shared/lib/errorHandler';

describe('classifyError', () => {
  it('영상 접근 불가 (403/비공개/지역)', () => {
    expect(classifyError('HTTP Error 403: Forbidden')).toBe('VIDEO_UNAVAILABLE');
    expect(classifyError('ERROR: [youtube] This video is private')).toBe('VIDEO_UNAVAILABLE');
    expect(classifyError('Sign in to confirm your age')).toBe('VIDEO_UNAVAILABLE');
    expect(classifyError('Video unavailable')).toBe('VIDEO_UNAVAILABLE');
  });

  it('바이너리 없음', () => {
    expect(classifyError('spawn aria2c ENOENT')).toBe('BINARY_MISSING');
    expect(classifyError('yt-dlp이 설치되어 있지 않습니다')).toBe('BINARY_MISSING');
    expect(classifyError('command not found: ffmpeg')).toBe('BINARY_MISSING');
  });

  it('타임아웃', () => {
    expect(classifyError('Download timed out after 45000ms')).toBe('TIMEOUT');
    expect(classifyError('stall detected')).toBe('TIMEOUT');
  });

  it('네트워크', () => {
    expect(classifyError('fetch failed')).toBe('NETWORK_ERROR');
    expect(classifyError('connect ECONNREFUSED 127.0.0.1:3000')).toBe('NETWORK_ERROR');
    expect(classifyError('서버에 연결할 수 없습니다')).toBe('NETWORK_ERROR');
  });

  it('메모리/코덱/손상', () => {
    expect(classifyError('Out of memory')).toBe('MEMORY_INSUFFICIENT');
    expect(classifyError('Unknown codec foo')).toBe('CODEC_UNSUPPORTED');
    expect(classifyError('moov atom not found')).toBe('FILE_CORRUPTED');
  });

  it('다운로드 일반 (구체 시그널 없을 때)', () => {
    expect(classifyError('yt-dlp 다운로드에 실패했습니다: giving up')).toBe('DOWNLOAD_ERROR');
    expect(classifyError('aria2 exited with code 1')).toBe('DOWNLOAD_ERROR');
  });

  it('403이 네트워크보다 우선 분류된다', () => {
    expect(classifyError('HTTP Error 403: Forbidden (connection)')).toBe('VIDEO_UNAVAILABLE');
  });

  it('미분류는 UNKNOWN', () => {
    expect(classifyError('something weird happened')).toBe('UNKNOWN');
    expect(classifyError('')).toBe('UNKNOWN');
  });
});

describe('parseFFmpegError', () => {
  it('분류 가능한 코드는 그대로', () => {
    expect(parseFFmpegError(new Error('Out of memory')).code).toBe('MEMORY_INSUFFICIENT');
    expect(parseFFmpegError(new Error('moov atom not found')).code).toBe('FILE_CORRUPTED');
  });

  it('미분류는 PROCESSING_FAILED로 폴백 (export 맥락)', () => {
    expect(parseFFmpegError(new Error('something weird')).code).toBe('PROCESSING_FAILED');
    expect(parseFFmpegError(new Error('Video trimming failed')).code).toBe('PROCESSING_FAILED');
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
    expect(err.userMessage).toBe('지원하지 않는 비디오 포맷입니다.');
    expect(err.solution).toContain('MP4');
    expect(err.technicalDetails).toBe('detail');
  });

  it('신규 서버 코드도 정의가 있다', () => {
    for (const code of ['VIDEO_UNAVAILABLE', 'BINARY_MISSING', 'NETWORK_ERROR', 'TIMEOUT', 'DOWNLOAD_ERROR', 'SERVER_ERROR'] as const) {
      const def = getErrorDefinition(code);
      expect(def.userMessage).toBeTruthy();
      expect(def.solution).toBeTruthy();
    }
  });
});

describe('isErrorCode', () => {
  it('유효/무효 코드 판별', () => {
    expect(isErrorCode('VIDEO_UNAVAILABLE')).toBe(true);
    expect(isErrorCode('DOWNLOAD_ERROR')).toBe(true);
    expect(isErrorCode('NOPE')).toBe(false);
    expect(isErrorCode(null)).toBe(false);
  });
});

describe('formatErrorReport', () => {
  it('code/메시지/정황/기술상세를 포함', () => {
    const report = formatErrorReport({
      code: 'VIDEO_UNAVAILABLE',
      message: 'Video unavailable',
      userMessage: '영상을 가져올 수 없습니다 (비공개·삭제·지역 제한 등).',
      solution: '공개 상태 확인',
      technicalDetails: 'ERROR: [youtube] HTTP 403',
      context: { jobId: 'abc-123', stage: 'yt-dlp download', exitCode: 1, timestamp: '2026-06-24T00:00:00.000Z' },
    });
    expect(report).toContain('code: VIDEO_UNAVAILABLE');
    expect(report).toContain('stage: yt-dlp download');
    expect(report).toContain('jobId: abc-123');
    expect(report).toContain('exitCode: 1');
    expect(report).toContain('timestamp: 2026-06-24T00:00:00.000Z');
    expect(report).toContain('HTTP 403');
  });
});
