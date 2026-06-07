import { describe, it, expect } from 'vitest';
import { getChzzkVideoNo } from '@/features/url-input/utils/chzzkVideo';

describe('getChzzkVideoNo', () => {
  it('chzzk VOD URL에서 videoNo 추출', () => {
    expect(getChzzkVideoNo('https://chzzk.naver.com/video/13413121')).toBe('13413121');
  });

  it('쿼리/해시 붙어도 추출', () => {
    expect(getChzzkVideoNo('https://chzzk.naver.com/video/123?foo=bar#t=10')).toBe('123');
  });

  it('trailing path 있어도 추출', () => {
    expect(getChzzkVideoNo('https://chzzk.naver.com/video/456/extra')).toBe('456');
  });

  it('live URL은 null (VOD 아님)', () => {
    expect(getChzzkVideoNo('https://chzzk.naver.com/live/abcdef123')).toBeNull();
  });

  it('chzzk 채널 URL은 null', () => {
    expect(getChzzkVideoNo('https://chzzk.naver.com/abcdef123')).toBeNull();
  });

  it('비-chzzk 도메인은 null', () => {
    expect(getChzzkVideoNo('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(getChzzkVideoNo('https://example.com/video/123')).toBeNull();
  });

  it('videoNo가 숫자 아니면 null', () => {
    expect(getChzzkVideoNo('https://chzzk.naver.com/video/abc')).toBeNull();
  });

  it('유효하지 않은 URL은 null', () => {
    expect(getChzzkVideoNo('not a url')).toBeNull();
    expect(getChzzkVideoNo('')).toBeNull();
  });
});
