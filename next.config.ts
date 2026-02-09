import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg', 'yt-dlp-wrap'],
  async headers() {
    return [
      {
        // Exclude API routes from strict COEP (proxy responses need cross-origin access)
        source: '/api/:path*',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'unsafe-none',
          },
        ],
      },
      {
        source: '/((?!api/).*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
