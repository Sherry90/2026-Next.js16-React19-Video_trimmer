import type { Metadata } from 'next';
import './globals.css';
import { DevTools } from '@/components/DevTools';

export const metadata: Metadata = {
  title: 'Video Trimmer',
  description: 'Trim videos in your browser',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {process.env.NODE_ENV === 'development' && <DevTools />}
        {children}
      </body>
    </html>
  );
}
