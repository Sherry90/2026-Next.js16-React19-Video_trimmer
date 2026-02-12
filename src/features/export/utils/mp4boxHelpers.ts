import type { Sample, Track } from 'mp4box';

/**
 * 키프레임 범위 찾기
 *
 * 시작/종료 시간에 해당하는 샘플 인덱스를 찾음
 * - 시작: startTime 이후 첫 번째 키프레임 (또는 이전 가장 가까운 키프레임)
 * - 종료: endTime 이전 마지막 샘플
 *
 * @param samples - 전체 샘플 배열
 * @param startDts - 시작 DTS (decode timestamp)
 * @param endDts - 종료 DTS
 * @returns 첫 번째 인덱스와 마지막 인덱스 (없으면 -1)
 */
export function findKeyframeRange(
  samples: Sample[],
  startDts: number,
  endDts: number
): { firstIndex: number; lastIndex: number } {
  let firstKeyframeIndex = -1;
  let lastSampleIndex = -1;

  // Find first keyframe at or after start time
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample.is_sync && sample.dts >= startDts) {
      firstKeyframeIndex = i;
      break;
    }
  }

  // If no keyframe found after start, use first keyframe before start
  if (firstKeyframeIndex === -1) {
    for (let i = samples.length - 1; i >= 0; i--) {
      const sample = samples[i];
      if (sample.is_sync && sample.dts <= startDts) {
        firstKeyframeIndex = i;
        break;
      }
    }
  }

  // Find last sample before or at end time
  for (let i = samples.length - 1; i >= 0; i--) {
    const sample = samples[i];
    if (sample.dts <= endDts) {
      lastSampleIndex = i;
      break;
    }
  }

  return {
    firstIndex: firstKeyframeIndex,
    lastIndex: lastSampleIndex,
  };
}

/**
 * 샘플 시간 범위로 필터링
 *
 * @param samples - 전체 샘플 배열
 * @param trackInfo - 트랙 정보 (timescale 포함)
 * @param startTime - 시작 시간 (초)
 * @param endTime - 종료 시간 (초)
 * @returns 필터링된 샘플 배열
 */
export function filterSamplesByTimeRange(
  samples: Sample[],
  trackInfo: Track,
  startTime: number,
  endTime: number
): Sample[] {
  const timescale = trackInfo.timescale;
  const startDts = Math.floor(startTime * timescale);
  const endDts = Math.floor(endTime * timescale);

  const { firstIndex, lastIndex } = findKeyframeRange(
    samples,
    startDts,
    endDts
  );

  // Extract trimmed samples
  if (
    firstIndex !== -1 &&
    lastIndex !== -1 &&
    firstIndex <= lastIndex
  ) {
    return samples.slice(firstIndex, lastIndex + 1);
  }

  return [];
}

/**
 * 완료 감지기 생성
 *
 * MP4Box의 onSamples가 완료되었는지 감지하기 위한 헬퍼
 * - 150ms 동안 샘플이 없으면 완료로 간주
 * - 50ms마다 체크
 *
 * @param onComplete - 완료 시 호출될 콜백
 * @returns start, cleanup 함수
 */
export function createCompletionDetector(
  onComplete: () => void
): {
  start: () => void;
  notifySample: () => void;
  cleanup: () => void;
} {
  let lastSampleTime = Date.now();
  let intervalId: NodeJS.Timeout | null = null;

  const start = () => {
    if (intervalId) return; // Already started

    lastSampleTime = Date.now();

    // Check every 50ms if no samples received for 150ms
    intervalId = setInterval(() => {
      const timeSinceLastSample = Date.now() - lastSampleTime;
      if (timeSinceLastSample > 150) {
        cleanup();
        onComplete();
      }
    }, 50);
  };

  const notifySample = () => {
    lastSampleTime = Date.now();
  };

  const cleanup = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  return {
    start,
    notifySample,
    cleanup,
  };
}
