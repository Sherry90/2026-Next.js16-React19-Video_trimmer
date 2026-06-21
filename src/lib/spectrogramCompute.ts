import { WAVEFORM, WAVEFORM_VIEW } from '@/constants/appConfig';
import {
  bucketMagnitudes,
  computeMagnitudeSpectrum,
  hannWindow,
  type SpectrogramData,
} from '@/shared/lib/spectrogram';

// 분석 해상도는 클라이언트(로컬 파일)와 동일 상수에서 — URL/파일 스펙트럴 일관성.
// SAMPLE_RATE 는 route.ts 의 ffmpeg -ar 추출 레이트와 짝이라 여기서 별도 고정(분리 시 시간축 깨짐).
const SAMPLE_RATE = WAVEFORM_VIEW.SPECTRAL_SAMPLE_RATE;
const FFT_SIZE = WAVEFORM_VIEW.SPECTRAL_FFT_SIZE;
const HOP_SIZE = WAVEFORM_VIEW.SPECTRAL_HOP_SIZE;
const FREQ_BINS = WAVEFORM_VIEW.SPECTRAL_FREQ_BINS;
const MAX_FRAMES = WAVEFORM_VIEW.SPECTRAL_MAX_FRAMES;
const LOG_SCALE = WAVEFORM_VIEW.SPECTRAL_LOG_SCALE;

export class SpectrogramTooLongError extends Error {}

export function computeSpectrogram(pcm: Buffer): SpectrogramData {
  const sampleCount = Math.floor(pcm.length / 2);
  const duration = sampleCount / SAMPLE_RATE;
  if (duration > WAVEFORM.MAX_DURATION_SEC) {
    throw new SpectrogramTooLongError('오디오가 너무 깁니다');
  }
  if (sampleCount === 0) {
    return { duration: 0, sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE, frames: [] };
  }

  const samples = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = pcm.readInt16LE(i * 2) / 32768;
  }

  const window = hannWindow(FFT_SIZE);
  const totalFrames = Math.max(1, Math.floor((sampleCount - FFT_SIZE) / HOP_SIZE) + 1);
  const stride = Math.max(1, Math.ceil(totalFrames / MAX_FRAMES));
  const frames: number[][] = [];

  for (let frame = 0; frame < totalFrames; frame += stride) {
    const start = frame * HOP_SIZE;
    const windowed = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      windowed[i] = (samples[start + i] ?? 0) * window[i];
    }

    frames.push(
      bucketMagnitudes(computeMagnitudeSpectrum(windowed), FREQ_BINS)
        .map((value) => Math.round(Math.min(1, Math.log10(1 + value * LOG_SCALE)) * 1000) / 1000)
    );
  }

  return { duration, sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE, frames };
}
