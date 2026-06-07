import { useState, useCallback, useRef } from 'react';
import { useStore } from '@/stores/useStore';
import { prefetchWaveform, clearWaveform } from '@/shared/lib/waveformCache';
import { getYoutubeThumbnail } from '@/shared/lib/platformUrl';

export interface UrlPreview {
  title: string | null;
  thumbnail: string | null;
}

export function useUrlInput() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // resolve(yt-dlp ~3초)와 병렬로 채워지는 즉시 프리뷰(제목/썸네일).
  const [preview, setPreview] = useState<UrlPreview | null>(null);
  // 마지막 제출 URL — 늦게 도착한 프리뷰 응답이 새 입력을 덮어쓰지 않도록 가드.
  const latestUrlRef = useRef<string>('');

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
    latestUrlRef.current = trimmedUrl;

    // 즉시 프리뷰(체감용). YouTube는 video ID로 썸네일을 0ms 계산해 바로 표시 가능하지만,
    // Chzzk는 썸네일 계산 불가 → 아래 서버 프리뷰 응답(약 0.3s)으로 채운다.
    const instantThumb = getYoutubeThumbnail(trimmedUrl);
    setPreview(instantThumb ? { title: null, thumbnail: instantThumb } : null);

    // 제목/썸네일을 플랫폼별 프리뷰 프록시에서 받는다(YouTube=oembed, Chzzk=chzzk API).
    // resolve와 병렬. stale 응답은 가드로 무시.
    fetch(`/api/video/preview?url=${encodeURIComponent(trimmedUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UrlPreview | null) => {
        if (!d || latestUrlRef.current !== trimmedUrl) return;
        setPreview((prev) => ({
          title: d.title ?? prev?.title ?? null,
          thumbnail: d.thumbnail ?? prev?.thumbnail ?? instantThumb,
        }));
      })
      .catch(() => {});

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
        setPreview(null);          // 실패 시 프리뷰 제거
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
      setPreview(null);
      setError('서버에 연결할 수 없습니다');
    } finally {
      setIsLoading(false);
    }
  }, [setVideoFile, setPhase, setInPoint, setOutPoint]);

  const clearPreview = useCallback(() => {
    latestUrlRef.current = '';
    setPreview(null);
  }, []);

  return {
    isLoading,
    error,
    preview,
    handleUrlSubmit,
    clearError: useCallback(() => setError(null), []),
    clearPreview,
  };
}
