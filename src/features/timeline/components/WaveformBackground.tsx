'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { useStore } from '@/stores/useStore';
import { UI } from '@/constants/appConfig';
import { getWaveform, clearWaveform, shouldSkipWaveform, scalePeaksToDuration } from '@/shared/lib/waveformCache';
import { getSpectrogram, clearSpectrogram } from '@/shared/lib/spectrogramCache';
import {
  bucketMagnitudes,
  computeMagnitudeSpectrum,
  hannWindow,
  isValidSpectrogramData,
  spectrogramFrameWidth,
  type SpectrogramData,
} from '@/shared/lib/spectrogram';

const LOCAL_SPECTROGRAM_SAMPLE_RATE = 8000;
const LOCAL_FFT_SIZE = 256;
const LOCAL_HOP_SIZE = 512;
const LOCAL_FREQ_BINS = 64;
const LOCAL_MAX_FRAMES = 1200;

type SpectrogramStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'skipped';

export function WaveformBackground() {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [hasAudio, setHasAudio] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // 길이 초과로 파형을 생략한 상태 (no-audio와 구분된 안내 표시)
  const [skipped, setSkipped] = useState<boolean>(false);

  const videoFile = useStore((state) => state.videoFile);
  const displayMode = useStore((state) => state.timeline.waveformDisplayMode ?? 'waveform');
  const zoom = useStore((state) => state.timeline.zoom);
  const waveformProgress = useStore((state) => state.processing.waveformProgress);
  const setProgress = useStore((state) => state.setProgress);
  const spectrogramCanvasRef = useRef<HTMLCanvasElement>(null);
  const [spectrogram, setSpectrogram] = useState<SpectrogramData | null>(null);
  const [spectrogramStatus, setSpectrogramStatus] = useState<SpectrogramStatus>('idle');
  const [spectrogramMessage, setSpectrogramMessage] = useState<string>('');
  const [containerWidth, setContainerWidth] = useState<number>(0);

  const renderSpectrogram = useCallback(() => {
    const canvas = spectrogramCanvasRef.current;
    if (!canvas || displayMode !== 'spectrogram') return;

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    // Safari 등 캔버스 per-dimension 한계(~16384)를 넘으면 빈 캔버스가 됨.
    // CSS 폭(width)은 그대로 두고 backing-store 해상도만 낮춰 정합은 유지.
    const MAX_CANVAS_DIM = 16384;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_DIM / width);
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#101114';
    ctx.fillRect(0, 0, width, height);

    if (!spectrogram || spectrogram.frames.length === 0) return;

    const frames = spectrogram.frames;
    const binCount = frames[0]?.length ?? 1;

    // 프레임을 실제 시간 위치로 배치(videoFile.duration 기준 — playhead/핸들과 동일 축).
    // audioDur < videoDur 면 스펙트럴이 좌측만 덮고 우측은 여백(오디오가 영상보다 짧음).
    const frameWidth = spectrogramFrameWidth(
      spectrogram.duration,
      videoFile?.duration ?? 0,
      frames.length,
      width
    );

    // 프레임을 frameCount×binCount 오프스크린 ImageData 한 장으로 채운 뒤
    // 메인 캔버스로 스케일 blit — fillRect 수만~수십만 회 대신 putImageData+drawImage 2회.
    const frameCount = frames.length;
    const offscreen = document.createElement('canvas');
    offscreen.width = frameCount;
    offscreen.height = binCount;
    const offCtx = offscreen.getContext('2d');
    if (!offCtx) return;

    const image = offCtx.createImageData(frameCount, binCount);
    for (let x = 0; x < frameCount; x++) {
      const frame = frames[x];
      for (let y = 0; y < frame.length; y++) {
        const intensity = Math.max(0, Math.min(1, frame[y]));
        const hue = 226 - intensity * 178;
        const saturation = 50 + intensity * 45;
        const lightness = 10 + intensity * 54;
        const [r, g, b] = hslToRgb(hue, saturation, lightness);
        // 저주파(y=0)를 하단에 배치 → row 뒤집기
        const row = binCount - 1 - y;
        const idx = (row * frameCount + x) * 4;
        image.data[idx] = r;
        image.data[idx + 1] = g;
        image.data[idx + 2] = b;
        image.data[idx + 3] = 255;
      }
    }
    offCtx.putImageData(image, 0, 0);

    // drawImage 로 frameWidth(=videoDuration 정합 폭)에 맞춰 가로 스케일, 세로는 height 가득.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offscreen, 0, 0, frameCount, binCount, 0, 0, frameCount * frameWidth, height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [displayMode, spectrogram, videoFile]);

  useEffect(() => {
    if (!videoFile) return;

    let cancelled = false;

    const createInstance = (extra?: { peaks?: number[][] }) => {
      if (!waveformRef.current) return null;

      // Cleanup previous instance
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }

      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: '#4fa3ff',
        progressColor: 'transparent',
        cursorColor: 'transparent',
        barWidth: zoom > 4 ? 1 : 2,
        barGap: 1,
        height: 80,
        normalize: true,
        interact: false,
        hideScrollbar: true,
        // 줌은 부모 content track 폭(contentWidth)으로 처리 → fillParent 로 부모 폭을 정확히 채움.
        // 시간축은 videoFile.duration 단일 기준으로 강제(서버 오디오/디코드 길이 대신).
        ...(videoFile.duration > 0 ? { duration: videoFile.duration } : {}),
        ...(extra?.peaks ? { peaks: extra.peaks } : {}),
      });
      wavesurferRef.current = wavesurfer;
      return wavesurfer;
    };

    const initializeWaveSurfer = async () => {
      if (!waveformRef.current) return;

      setIsLoading(true);
      setSkipped(false);
      setProgress('waveform',0);

      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }

      try {
        // URL 소스: 영상 전체를 받지 않고 서버에서 오디오-only peaks만 가져온다.
        if (videoFile.source === 'url') {
          const target = videoFile.originalUrl;
          if (!target) {
            setHasAudio(false);
            setIsLoading(false);
            return;
          }

          // 길이 게이트: 너무 긴 소스는 파형 생략(전체 오디오 추출이 메모리/시간 한도 초과).
          // 진행 중인 prefetch 추출도 중단해 서버 낭비를 끊는다.
          if (shouldSkipWaveform(videoFile.duration)) {
            clearWaveform(target);
            setSkipped(true);
            setHasAudio(false);
            setIsLoading(false);
            setProgress('waveform',100);
            return;
          }

          // URL 입력 시 prefetch된 캐시 Promise 소비 (재요청 없음, 진입~표시 공백 제거)
          let peaks: number[][];
          let duration: number;
          let serverSkipped: boolean | undefined;
          try {
            ({ peaks, duration, skipped: serverSkipped } = await getWaveform(target));
          } catch {
            if (cancelled) return;
            setHasAudio(false);
            setIsLoading(false);
            setProgress('waveform',100);
            return;
          }
          if (cancelled) return;

          // 서버가 길이 초과 등으로 생략한 경우도 동일 안내
          if (serverSkipped) {
            setSkipped(true);
            setHasAudio(false);
            setIsLoading(false);
            setProgress('waveform',100);
            return;
          }

          const hasPeaks = Array.isArray(peaks) && peaks[0]?.length > 0;

          // 추출 오디오 길이(duration)를 videoFile.duration 축에 맞게 peaks 스케일
          // → WaveSurfer가 폭에 가득 펴도 playhead/스펙트럴과 정합(우측 여백 포함).
          const scaledPeaks = scalePeaksToDuration(peaks, duration, videoFile.duration);

          // 사전 계산된 peaks로 렌더 (미디어 fetch 없음): create options로 주입
          const wavesurfer = createInstance({ peaks: scaledPeaks });
          if (!wavesurfer) return;

          wavesurfer.on('error', (error) => {
            console.warn('Waveform render error:', error);
            setHasAudio(false);
            setIsLoading(false);
            setProgress('waveform',100);
          });

          setHasAudio(hasPeaks);
          setIsLoading(false);
          setProgress('waveform',100);
          return;
        }

        // 파일 소스: 기존 방식 — 로컬 blob에서 직접 디코드
        const wavesurfer = createInstance();
        if (!wavesurfer) return;

        wavesurfer.on('loading', (percent) => setProgress('waveform',percent));
        wavesurfer.on('ready', () => {
          setIsLoading(false);
          setProgress('waveform',100);
          setHasAudio(true);
        });
        wavesurfer.on('error', (error) => {
          console.warn('Waveform error (possibly no audio):', error);
          setHasAudio(false);
          setIsLoading(false);
          setProgress('waveform',100);
        });

        wavesurfer.load(videoFile.url);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to create WaveSurfer:', error);
        setHasAudio(false);
        setIsLoading(false);
      }
    };

    // Use setTimeout to ensure DOM is ready
    const timer = setTimeout(initializeWaveSurfer, UI.WAVEFORM_INIT_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, [videoFile, setProgress]);

  // barWidth만 zoom 에 반응 — 인스턴스 재생성 없이 옵션만 갱신(줌마다 리로드/로딩 깜빡임 방지).
  useEffect(() => {
    wavesurferRef.current?.setOptions({ barWidth: zoom > 4 ? 1 : 2 });
  }, [zoom]);

  // 스펙트럼은 displayMode와 무관하게 영상 로드 시 백그라운드에서 미리 연산해 둔다.
  // → 'Spectral' 토글 시 새로 계산하지 않고 즉시 표시(파형과 동일하게 준비 완료 상태).
  useEffect(() => {
    if (!videoFile) return;
    let cancelled = false;

    const computeSpectrogramData = async () => {
      setSpectrogram(null);
      setSpectrogramStatus('loading');
      setSpectrogramMessage('');

      try {
        if (shouldSkipWaveform(videoFile.duration)) {
          if (videoFile.originalUrl) clearSpectrogram(videoFile.originalUrl);
          setSpectrogramStatus('skipped');
          setSpectrogramMessage('영상이 길어 스펙트럼을 생략했습니다');
          return;
        }

        const data = videoFile.source === 'url' && videoFile.originalUrl
          ? await getSpectrogram(videoFile.originalUrl)
          : await computeLocalSpectrogram(videoFile.url, videoFile.duration);

        if (cancelled) return;
        if (!isValidSpectrogramData(data)) {
          setSpectrogramStatus('error');
          setSpectrogramMessage('스펙트럼 응답 형식이 올바르지 않습니다');
          return;
        }
        if (data.skipped) {
          setSpectrogramStatus('skipped');
          setSpectrogramMessage('영상이 길어 스펙트럼을 생략했습니다');
          return;
        }
        setSpectrogram(data);
        const hasFrames = data.frames.length > 0 && data.frames.some((frame) => frame.length > 0);
        setSpectrogramStatus(hasFrames ? 'ready' : 'empty');
        setSpectrogramMessage(hasFrames ? '' : '스펙트럼 데이터가 비어 있습니다');
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to compute spectrogram:', error);
        setSpectrogramStatus('error');
        setSpectrogramMessage('스펙트럼을 표시할 수 없습니다');
      }
    };

    computeSpectrogramData();
    return () => {
      cancelled = true;
    };
  }, [videoFile]);

  useEffect(() => {
    const target = waveformRef.current;
    if (!target) return;

    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (displayMode !== 'spectrogram') return;

    const frame = requestAnimationFrame(renderSpectrogram);
    return () => cancelAnimationFrame(frame);
  }, [renderSpectrogram, containerWidth, displayMode, spectrogramStatus]);

  // 오버레이는 현재 표시 모드의 준비 상태를 따른다(두 모드 모두 백그라운드 준비됨).
  const isSpectral = displayMode === 'spectrogram';
  const showLoading = isSpectral ? spectrogramStatus === 'loading' : isLoading;
  const showEmpty = isSpectral
    ? spectrogramStatus === 'error' || spectrogramStatus === 'empty' || spectrogramStatus === 'skipped'
    : !isLoading && !hasAudio;

  return (
    <div className="w-full h-full overflow-hidden pointer-events-none relative">
      <div className="absolute inset-0 bg-[#14161a]">
        <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:64px_100%,100%_20px]" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-[#ffee65]/45" />
      </div>

      {/* Waveform container - always rendered so ref can attach */}
      <div
        ref={waveformRef}
        className={`w-full h-full absolute inset-0 ${displayMode === 'waveform' ? 'opacity-100' : 'opacity-0'}`}
      />

      <canvas
        ref={spectrogramCanvasRef}
        data-testid="spectrogram-canvas"
        className={`absolute inset-0 h-full w-full ${displayMode === 'spectrogram' ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Loading overlay — 현재 표시 모드 기준 */}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1c1d20] z-10">
          <div className="text-xs text-[#74808c]">
            {displayMode === 'spectrogram'
              ? '스펙트럼 분석 중...'
              : `Loading waveform... ${Math.round(waveformProgress)}%`}
          </div>
        </div>
      )}

      {/* No audio / skipped overlay — 현재 표시 모드 기준 */}
      {!showLoading && showEmpty && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1c1d20] z-10">
          <div className="text-xs text-[#74808c]" data-testid="waveform-empty-message">
            {displayMode === 'spectrogram'
              ? spectrogramMessage || '스펙트럼을 표시할 수 없습니다'
              : skipped ? '영상이 길어 파형을 생략했습니다' : 'No audio track'}
          </div>
        </div>
      )}
    </div>
  );
}

// hsl(h, s%, l%) → [r,g,b] (0-255). ImageData 픽셀 직접 채우기용.
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lig - c / 2;
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

async function computeLocalSpectrogram(url: string, duration: number): Promise<SpectrogramData> {
  if (shouldSkipWaveform(duration)) {
    return { duration: 0, sampleRate: LOCAL_SPECTROGRAM_SAMPLE_RATE, fftSize: LOCAL_FFT_SIZE, frames: [], skipped: true };
  }

  const AudioContextCtor = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error('AudioContext를 사용할 수 없습니다');
  }
  const audioContext = new AudioContextCtor({ sampleRate: LOCAL_SPECTROGRAM_SAMPLE_RATE });
  try {
    const buffer = await fetch(url).then((res) => res.arrayBuffer());
    const decoded = await audioContext.decodeAudioData(buffer.slice(0));
    const source = decoded.getChannelData(0);
    const sampleCount = Math.floor(decoded.duration * LOCAL_SPECTROGRAM_SAMPLE_RATE);
    const samples = new Float32Array(sampleCount);
    // step>1(컨텍스트가 8kHz 강제를 무시하고 native rate 로 디코드한 브라우저)이면
    // 단순 데시메이션은 앨리어싱을 부른다 → 구간 박스 평균으로 1차 로우패스.
    const step = decoded.sampleRate / LOCAL_SPECTROGRAM_SAMPLE_RATE;
    if (step <= 1) {
      for (let i = 0; i < sampleCount; i++) {
        samples[i] = source[Math.min(source.length - 1, Math.floor(i * step))] ?? 0;
      }
    } else {
      const window = Math.max(1, Math.floor(step));
      for (let i = 0; i < sampleCount; i++) {
        const start = Math.floor(i * step);
        let sum = 0;
        let count = 0;
        for (let j = 0; j < window && start + j < source.length; j++) {
          sum += source[start + j];
          count++;
        }
        samples[i] = count > 0 ? sum / count : 0;
      }
    }

    const windowValues = hannWindow(LOCAL_FFT_SIZE);
    const totalFrames = Math.max(1, Math.floor((sampleCount - LOCAL_FFT_SIZE) / LOCAL_HOP_SIZE) + 1);
    const stride = Math.max(1, Math.ceil(totalFrames / LOCAL_MAX_FRAMES));
    const frames: number[][] = [];

    for (let frame = 0; frame < totalFrames; frame += stride) {
      const start = frame * LOCAL_HOP_SIZE;
      const windowed = new Float32Array(LOCAL_FFT_SIZE);
      for (let i = 0; i < LOCAL_FFT_SIZE; i++) {
        windowed[i] = (samples[start + i] ?? 0) * windowValues[i];
      }
      frames.push(
        bucketMagnitudes(computeMagnitudeSpectrum(windowed), LOCAL_FREQ_BINS)
          .map((value) => Math.round(Math.min(1, Math.log10(1 + value * 80)) * 1000) / 1000)
      );
    }

    return {
      duration: decoded.duration,
      sampleRate: LOCAL_SPECTROGRAM_SAMPLE_RATE,
      fftSize: LOCAL_FFT_SIZE,
      frames,
    };
  } finally {
    void audioContext.close();
  }
}
