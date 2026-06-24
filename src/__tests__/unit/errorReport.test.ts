import { describe, it, expect, vi } from 'vitest';
import { buildServerError, reportServerError } from '@/lib/errorReport';

describe('buildServerError', () => {
  it('stderr를 분류해 code/userMessage/cause를 채운다', () => {
    const r = buildServerError('yt-dlp download', 'ERROR: [youtube] HTTP Error 403: Forbidden', { jobId: 'job-1' });
    expect(r.code).toBe('VIDEO_UNAVAILABLE');
    expect(r.userMessage).toContain('가져올 수 없습니다');
    expect(r.solution).toBeTruthy();
    expect(r.cause).toContain('403');
    expect(r.stage).toBe('yt-dlp download');
    expect(r.jobId).toBe('job-1');
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('Error 객체도 받는다', () => {
    const r = buildServerError('ffmpeg cut', new Error('spawn ffmpeg ENOENT'));
    expect(r.code).toBe('BINARY_MISSING');
    expect(r.cause).toContain('ENOENT');
  });

  it('강제 code 지정 시 분류를 건너뛴다', () => {
    const r = buildServerError('validate', 'whatever', { code: 'VALIDATION_ERROR' });
    expect(r.code).toBe('VALIDATION_ERROR');
  });

  it('exitCode 정황을 보존', () => {
    const r = buildServerError('streamlink download', 'giving up', { exitCode: 1, command: 'streamlink ...' });
    expect(r.exitCode).toBe(1);
    expect(r.command).toBe('streamlink ...');
  });
});

describe('reportServerError', () => {
  it('빌드 + 구조화 로그 한 줄 출력 후 report 반환', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = reportServerError('yt-dlp download', 'fetch failed', { jobId: 'j2' });
    expect(r.code).toBe('NETWORK_ERROR');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe('[error-report]');
    spy.mockRestore();
  });
});
