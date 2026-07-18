export interface SpectrogramData {
  duration: number;
  sampleRate: number;
  fftSize: number;
  frames: number[][];
  skipped?: boolean;
  reason?: string;
}

export function isValidSpectrogramData(value: unknown): value is SpectrogramData {
  if (!value || typeof value !== "object") return false;

  const data = value as Partial<SpectrogramData>;
  if (data.skipped) return true;
  if (typeof data.duration !== "number") return false;
  if (typeof data.sampleRate !== "number") return false;
  if (typeof data.fftSize !== "number") return false;
  if (!Array.isArray(data.frames)) return false;

  return data.frames.every(
    (frame) =>
      Array.isArray(frame) && frame.every((bin) => typeof bin === "number" && Number.isFinite(bin)),
  );
}

/**
 * 스펙트럴 프레임 한 칸의 가로 픽셀 폭.
 * videoDuration 기준(playhead/핸들과 동일 축)으로 audio 프레임을 실제 시간 위치에 배치.
 * audioDuration < videoDuration 이면 프레임 총합 폭 < width → 우측 여백(오디오가 영상보다 짧음).
 * 기준 길이가 없으면 컨테이너 폭에 균등 분할로 폴백.
 */
export function spectrogramFrameWidth(
  audioDuration: number,
  videoDuration: number,
  frameCount: number,
  width: number,
): number {
  if (frameCount <= 0 || width <= 0) return 0;
  const ref = videoDuration > 0 ? videoDuration : audioDuration;
  if (ref > 0 && audioDuration > 0) {
    return (audioDuration / frameCount / ref) * width;
  }
  return width / frameCount;
}

export function hannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  if (size <= 1) {
    window[0] = 1;
    return window;
  }

  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

export function computeMagnitudeSpectrum(samples: Float32Array): Float32Array {
  const n = samples.length;
  const bins = Math.floor(n / 2);
  const magnitudes = new Float32Array(bins);

  for (let k = 0; k < bins; k++) {
    let real = 0;
    let imag = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      real += samples[t] * Math.cos(angle);
      imag -= samples[t] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(real * real + imag * imag) / n;
  }

  return magnitudes;
}

export function bucketMagnitudes(magnitudes: Float32Array, bucketCount: number): number[] {
  const buckets = new Array<number>(bucketCount).fill(0);
  if (magnitudes.length === 0 || bucketCount === 0) return buckets;

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const start = Math.floor((bucket / bucketCount) * magnitudes.length);
    const end = Math.max(start + 1, Math.floor(((bucket + 1) / bucketCount) * magnitudes.length));
    let max = 0;
    for (let i = start; i < Math.min(end, magnitudes.length); i++) {
      if (magnitudes[i] > max) max = magnitudes[i];
    }
    buckets[bucket] = max;
  }

  return buckets;
}
