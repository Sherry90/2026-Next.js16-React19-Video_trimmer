import { WAVEFORM_VIEW } from "@/constants/appConfig";
import { shouldSkipWaveform } from "@/shared/lib/waveformCache";
import {
  bucketMagnitudes,
  computeMagnitudeSpectrum,
  hannWindow,
  type SpectrogramData,
} from "@/shared/lib/spectrogram";

const LOCAL_SPECTROGRAM_SAMPLE_RATE = WAVEFORM_VIEW.SPECTRAL_SAMPLE_RATE;
const LOCAL_FFT_SIZE = WAVEFORM_VIEW.SPECTRAL_FFT_SIZE;
const LOCAL_HOP_SIZE = WAVEFORM_VIEW.SPECTRAL_HOP_SIZE;
const LOCAL_FREQ_BINS = WAVEFORM_VIEW.SPECTRAL_FREQ_BINS;
const LOCAL_MAX_FRAMES = WAVEFORM_VIEW.SPECTRAL_MAX_FRAMES;

/**
 * 파일 소스용 로컬 스펙트로그램 연산 (브라우저 AudioContext로 오디오 디코드 → STFT).
 * URL 소스는 서버 fetch를 쓰므로 이 경로를 타지 않는다.
 */
export async function computeLocalSpectrogram(
  url: string,
  duration: number,
): Promise<SpectrogramData> {
  if (shouldSkipWaveform(duration)) {
    return {
      duration: 0,
      sampleRate: LOCAL_SPECTROGRAM_SAMPLE_RATE,
      fftSize: LOCAL_FFT_SIZE,
      frames: [],
      skipped: true,
    };
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("AudioContext를 사용할 수 없습니다");
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
    const totalFrames = Math.max(
      1,
      Math.floor((sampleCount - LOCAL_FFT_SIZE) / LOCAL_HOP_SIZE) + 1,
    );
    const stride = Math.max(1, Math.ceil(totalFrames / LOCAL_MAX_FRAMES));
    const frames: number[][] = [];

    for (let frame = 0; frame < totalFrames; frame += stride) {
      const start = frame * LOCAL_HOP_SIZE;
      const windowed = new Float32Array(LOCAL_FFT_SIZE);
      for (let i = 0; i < LOCAL_FFT_SIZE; i++) {
        windowed[i] = (samples[start + i] ?? 0) * windowValues[i];
      }
      frames.push(
        bucketMagnitudes(computeMagnitudeSpectrum(windowed), LOCAL_FREQ_BINS).map(
          (value) =>
            Math.round(
              Math.min(1, Math.log10(1 + value * WAVEFORM_VIEW.SPECTRAL_LOG_SCALE)) * 1000,
            ) / 1000,
        ),
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
