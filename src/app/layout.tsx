import type { Metadata } from 'next';
import './globals.css';

const appUrl = process.env.APP_URL || 'https://trimvideo.com';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: 'TrimVideo',
  description: 'Trim videos in your browser at trimvideo.com',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'TrimVideo',
    description: 'Trim videos in your browser at trimvideo.com',
    url: appUrl,
    siteName: 'TrimVideo',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
