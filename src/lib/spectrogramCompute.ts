import { WAVEFORM } from '@/constants/appConfig';
import {
  bucketMagnitudes,
  computeMagnitudeSpectrum,
  hannWindow,
  type SpectrogramData,
} from '@/shared/lib/spectrogram';

const SAMPLE_RATE = 8000;
const FFT_SIZE = 256;
const HOP_SIZE = 512;
const FREQ_BINS = 64;
const MAX_FRAMES = 1800;

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
        .map((value) => Math.round(Math.min(1, Math.log10(1 + value * 80)) * 1000) / 1000)
    );
  }

  return { duration, sampleRate: SAMPLE_RATE, fftSize: FFT_SIZE, frames };
}
