import { useState, useCallback } from 'react';
import { useStore } from '@/stores/useStore';
import { prefetchWaveform, clearWaveform } from '../utils/waveformCache';

export function useUrlInput() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setVideoFile = useStore((state) => state.setVideoFile);
  const setPhase = useStore((state) => state.setPhase);
  const setInPoint = useStore((state) => state.setInPoint);
  const setOutPoint = useStore((state) => state.setOutPoint);

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

    // 파형 추출을 resolve와 병렬로 시작 (둘 다 originalUrl만 필요 → 서버 yt-dlp 2개 병렬).
    // editing 진입 시 WaveformBackground가 이 캐시를 소비 → 파형이 더 빨리 표시됨.
    prefetchWaveform(trimmedUrl);

    try {
      const response = await fetch('/api/video/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmedUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        clearWaveform(trimmedUrl); // resolve 실패 → 불필요한 파형 추출 중단
        setError(data.error || '영상 정보를 가져올 수 없습니다');
        return;
      }

      const streamType: 'hls' | 'mp4' = data.streamType || 'mp4';
      const duration: number = data.duration || 0;

      // 스트리밍 소스를 바로 editing에 올린다 (전체 영상 위 구간 선택).
      // 재생은 프록시 경유(CORS/HLS 세그먼트 재작성), 다운로드는 originalUrl에서 별도 재해석.
      setVideoFile({
        file: null,
        source: 'url',
        name: `${data.title || 'video'}.mp4`,
        size: 0,
        type: streamType === 'hls' ? 'application/x-mpegURL' : 'video/mp4',
        url: `/api/video/proxy?url=${encodeURIComponent(data.url)}`,
        duration,
        streamUrl: data.url,
        streamType,
        thumbnail: data.thumbnail || '',
        originalUrl: trimmedUrl,
        tbr: data.tbr || null, // Total bitrate (kbps)
      });

      // 타임라인 기본 구간: 0 ~ 전체 길이 (구간 길이 상한 없음 — 사용자가 좁힌다)
      setOutPoint(duration);
      setInPoint(0);

      setPhase('editing');
    } catch {
      clearWaveform(trimmedUrl);
      setError('서버에 연결할 수 없습니다');
    } finally {
      setIsLoading(false);
    }
  }, [setVideoFile, setPhase, setInPoint, setOutPoint]);

  return {
    isLoading,
    error,
    handleUrlSubmit,
    clearError: useCallback(() => setError(null), []),
  };
}
