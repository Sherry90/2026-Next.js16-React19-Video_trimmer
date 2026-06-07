import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg'],
  async headers() {
    // NOTE: HSTS는 여기 두지 않는다 — next.config headers()는 빌드 타임에 평가되어
    // 런타임 env 토글이 불가하다. HSTS는 server.ts에서 ENABLE_HSTS로 런타임 제어한다.
    return [
      {
        // Exclude API routes from strict COEP (proxy responses need cross-origin access)
        source: '/api/:path*',
        headers: [{ key: 'Cross-Origin-Opener-Policy', value: 'unsafe-none' }],
      },
      {
        source: '/((?!api/).*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
