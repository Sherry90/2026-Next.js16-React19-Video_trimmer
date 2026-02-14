import { useState, useCallback } from 'react';
import { useStore } from '@/stores/useStore';

export function useUrlInput() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setUrlPreview = useStore((state) => state.setUrlPreview);

  const handleUrlSubmit = useCallback(async (url: string) => {
    // Basic URL validation
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    try {
      new URL(trimmedUrl);
    } catch {
      setError('유효하지 않은 URL입니다');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/video/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || '영상 정보를 가져올 수 없습니다');
        return;
      }

      setUrlPreview({
        title: data.title,
        duration: data.duration,
        thumbnail: data.thumbnail || '',
        streamUrl: data.url,
        streamType: data.streamType || 'mp4',
        originalUrl: trimmedUrl,
        tbr: data.tbr || null, // Total bitrate (kbps)
      });
    } catch {
      setError('서버에 연결할 수 없습니다');
    } finally {
      setIsLoading(false);
    }
  }, [setUrlPreview]);

  return {
    isLoading,
    error,
    handleUrlSubmit,
    clearError: useCallback(() => setError(null), []),
  };
}
