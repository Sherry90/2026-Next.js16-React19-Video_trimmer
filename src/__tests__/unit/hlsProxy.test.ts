import { describe, it, expect } from 'vitest';
import { rewriteM3U8, isHlsResponse, toProxyUrl } from '@/lib/hlsProxy';

const BASE = 'https://cdn.example.com/path/master.m3u8';
const proxied = (abs: string) => `/api/video/proxy?url=${encodeURIComponent(abs)}`;

describe('isHlsResponse', () => {
  it('detects by content-type', () => {
    expect(isHlsResponse('https://x/y', 'application/vnd.apple.mpegurl')).toBe(true);
    expect(isHlsResponse('https://x/y', 'application/x-mpegURL')).toBe(true);
  });

  it('detects by .m3u8 extension (ignoring query string)', () => {
    expect(isHlsResponse('https://x/playlist.m3u8?token=abc', null)).toBe(true);
  });

  it('returns false for non-HLS', () => {
    expect(isHlsResponse('https://x/video.mp4', 'video/mp4')).toBe(false);
    expect(isHlsResponse('https://x/video.ts', null)).toBe(false);
  });
});

describe('toProxyUrl', () => {
  it('resolves relative URIs against the playlist URL', () => {
    expect(toProxyUrl('seg1.ts', BASE)).toBe(proxied('https://cdn.example.com/path/seg1.ts'));
  });

  it('keeps absolute URIs', () => {
    expect(toProxyUrl('https://other.cdn/abs.ts', BASE)).toBe(proxied('https://other.cdn/abs.ts'));
  });
});

describe('rewriteM3U8', () => {
  it('rewrites plain segment URIs (relative + absolute)', () => {
    const input = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXTINF:10.0,',
      'seg0.ts',
      '#EXTINF:10.0,',
      'https://cdn2.example.com/seg1.ts',
    ].join('\n');

    const out = rewriteM3U8(input, BASE);
    expect(out).toContain(proxied('https://cdn.example.com/path/seg0.ts'));
    expect(out).toContain(proxied('https://cdn2.example.com/seg1.ts'));
    // comments/tags untouched
    expect(out).toContain('#EXTINF:10.0,');
    expect(out).toContain('#EXT-X-VERSION:3');
  });

  it('rewrites nested playlist URIs (master playlist)', () => {
    const input = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=800000',
      '720p/index.m3u8',
    ].join('\n');

    const out = rewriteM3U8(input, BASE);
    expect(out).toContain(proxied('https://cdn.example.com/path/720p/index.m3u8'));
  });

  it('rewrites URI="..." attributes in EXT-X-KEY and EXT-X-MAP', () => {
    const input = [
      '#EXTM3U',
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x123',
      '#EXT-X-MAP:URI="init.mp4"',
      '#EXTINF:4,',
      'seg.ts',
    ].join('\n');

    const out = rewriteM3U8(input, BASE);
    expect(out).toContain(`URI="${proxied('https://cdn.example.com/path/key.bin')}"`);
    expect(out).toContain(`URI="${proxied('https://cdn.example.com/path/init.mp4')}"`);
    // other attributes on the KEY line preserved
    expect(out).toContain('METHOD=AES-128');
    expect(out).toContain('IV=0x123');
    expect(out).toContain(proxied('https://cdn.example.com/path/seg.ts'));
  });

  it('preserves blank lines and does not touch tag-only lines', () => {
    const input = '#EXTM3U\n\n#EXT-X-ENDLIST';
    const out = rewriteM3U8(input, BASE);
    expect(out).toBe('#EXTM3U\n\n#EXT-X-ENDLIST');
  });
});
