const { spawn, execSync } = require('child_process');
const { existsSync } = require('fs');
const { getFfmpegPath } = require('./binPaths.cjs');
const { dirname, join } = require('path');

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function stripAnsi(input) {
  if (typeof input !== 'string') {
    return '';
  }
  // eslint-disable-next-line no-control-regex
  return input.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
}

function calculateProgress(processedSeconds, totalDuration) {
  if (!Number.isFinite(processedSeconds) || processedSeconds < 0) {
    return 0;
  }
  if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
    return 0;
  }
  return clamp((processedSeconds / totalDuration) * 100, 0, 100);
}

function parseClockDuration(value) {
  const match = value.match(/^(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }

  const [, hours, minutes, seconds] = match;
  return (
    parseInt(hours, 10) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseFloat(seconds)
  );
}

function parseUnitDuration(value) {
  const compact = value.toLowerCase().replace(/\s+/g, '');
  const matches = [...compact.matchAll(/(\d+(?:\.\d+)?)(h|m|s)/g)];
  if (matches.length === 0) {
    return null;
  }

  let total = 0;
  for (const [, amount, unit] of matches) {
    const numeric = parseFloat(amount);
    if (Number.isNaN(numeric)) {
      continue;
    }
    if (unit === 'h') {
      total += numeric * 3600;
    } else if (unit === 'm') {
      total += numeric * 60;
    } else if (unit === 's') {
      total += numeric;
    }
  }

  return total > 0 ? total : null;
}

/**
 * Parse a duration text used by Streamlink/FFmpeg logs.
 * Supported formats:
 * - 00:01:23.45
 * - 1h2m3s / 2m10s / 30s
 */
function parseFlexibleDuration(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const clock = parseClockDuration(trimmed);
  if (clock != null) {
    return clock;
  }

  const unit = parseUnitDuration(trimmed);
  if (unit != null) {
    return unit;
  }

  const secMatch = trimmed.match(/^(\d+(?:\.\d+)?)$/);
  if (secMatch) {
    return parseFloat(secMatch[1]);
  }

  return null;
}

/**
 * Parse a single Streamlink log line into progress percentage.
 * Progress 기준은 "선택된 구간 길이(targetDuration)" 대비 다운로드된 시간입니다.
 */
function parseStreamlinkProgressLine(line, targetDuration) {
  if (!line || targetDuration <= 0) {
    return null;
  }
  const cleanedLine = stripAnsi(line);

  const hasDownloadContext =
    /download|written|eta|\/s|byte|kb|mb|gb/i.test(cleanedLine);
  const percentMatch = cleanedLine.match(/(\d{1,3}(?:\.\d+)?)%/);
  if (hasDownloadContext && percentMatch) {
    const numeric = parseFloat(percentMatch[1]);
    if (!Number.isNaN(numeric)) {
      return clamp(numeric, 0, 100);
    }
  }

  // 일반적인 Streamlink 출력 예: "(34s @ 4025 kb/s)"
  const parenthetical = [...cleanedLine.matchAll(/\(([^)]+)\)/g)];
  for (const [, raw] of parenthetical) {
    const candidate = raw.split('@')[0]?.trim();
    if (!candidate) {
      continue;
    }
    const seconds = parseFlexibleDuration(candidate);
    if (seconds != null) {
      return calculateProgress(seconds, targetDuration);
    }
  }

  // 보조 파싱: 라인 전체에 시각 토큰이 있을 경우 마지막 토큰 사용
  const clockMatches = [...cleanedLine.matchAll(/\b\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\b/g)];
  if (clockMatches.length > 0) {
    const candidate = clockMatches[clockMatches.length - 1][0];
    const seconds = parseFlexibleDuration(candidate);
    if (seconds != null) {
      return calculateProgress(seconds, targetDuration);
    }
  }

  const unitMatches = [...cleanedLine.matchAll(/\b(?:\d+(?:\.\d+)?h)?(?:\d+(?:\.\d+)?m)?(?:\d+(?:\.\d+)?s)\b/gi)];
  if (unitMatches.length > 0) {
    const candidate = unitMatches[unitMatches.length - 1][0];
    const seconds = parseFlexibleDuration(candidate);
    if (seconds != null) {
      return calculateProgress(seconds, targetDuration);
    }
  }

  // ETA 기반 추정 (예: "... 00:00:05 / ETA 00:00:10")
  const etaMatch = cleanedLine.match(/\bETA\s+(\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)\b/i);
  if (etaMatch) {
    const etaSeconds = parseFlexibleDuration(etaMatch[1]);
    const lastClock = clockMatches.length > 0 ? clockMatches[clockMatches.length - 1][0] : null;
    const elapsedSeconds = lastClock ? parseFlexibleDuration(lastClock) : null;
    if (etaSeconds != null && elapsedSeconds != null && etaSeconds >= 0) {
      const total = elapsedSeconds + etaSeconds;
      if (total > 0) {
        return calculateProgress(elapsedSeconds, total);
      }
    }
  }

  return null;
}

/**
 * Get ffprobe binary path
 * Tries system ffprobe first, then tries same directory as ffmpeg
 */
function getFfprobePath() {
  // Try system ffprobe first
  try {
    execSync('which ffprobe', { stdio: 'ignore' });
    return 'ffprobe';
  } catch {
    // Try same directory as ffmpeg
    const ffmpegPath = getFfmpegPath();
    const ffmpegDir = dirname(ffmpegPath);
    const ffprobePath = join(ffmpegDir, 'ffprobe');

    if (existsSync(ffprobePath)) {
      return ffprobePath;
    }

    // Fallback: assume ffprobe is in PATH
    return 'ffprobe';
  }
}

/**
 * FFprobe로 파일의 duration 추출
 *
 * @param {string} filePath - 비디오 파일 경로
 * @returns {Promise<number>} duration (초 단위)
 */
async function getFileDuration(filePath) {
  if (!existsSync(filePath)) {
    return 0;
  }

  return new Promise((resolve, reject) => {
    const ffprobePath = getFfprobePath();

    const proc = spawn(ffprobePath, [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const duration = parseFloat(stdout.trim());
        if (!isNaN(duration)) {
          resolve(duration);
          return;
        }
      }
      // FFprobe 실패 시 0 반환 (에러 throw 대신)
      resolve(0);
    });

    proc.on('error', (err) => {
      console.error('[progressParser] FFprobe spawn error:', err);
      resolve(0);
    });
  });
}

/**
 * Streamlink progress parser (segment 카운트 기반)
 *
 * Streamlink stderr에서 "Download of segment X complete" 로그를 파싱하여
 * segment 카운트와 평균 시간 기반으로 progress를 계산합니다.
 *
 * 실제 다운로드된 세그먼트 수에 기반하여 0-100% progress를 계산합니다.
 * 가중치 없이 실제 진행도만 반환합니다.
 */
class StreamlinkProgressParser {
  // 평활화 계수 (0.0 ~ 1.0)
  // 1.0 = 평활화 없음 (순수 실제 데이터), 0.0 = 완전 평활화
  static SMOOTHING_ALPHA = 1.0;

  constructor(targetDuration) {
    this.targetDuration = targetDuration;
    this.segmentCount = 0;
    this.startTime = Date.now();
    this.lastSegmentTime = this.startTime;

    // 세그먼트 기반 계산을 위한 필드
    this.totalSegmentDuration = 0; // 측정된 세그먼트 길이 합
    this.avgSegmentDuration = 6; // HLS 기본 추정값 (6초)
    this.smoothedProgress = 0; // 지수 평활화된 progress

    // 중복 카운팅 방지 (재파싱 시)
    this.seenSegments = new Set();
  }

  /**
   * Streamlink stderr 라인 파싱
   *
   * @param {string} line - stderr 라인
   * @returns {number|null} progress (0-100) or null if no segment found
   */
  parseLine(line) {
    if (!line) {
      return null;
    }

    // Streamlink 실제 로그 형식 (대소문자 구분 없이):
    // "[stream.hls][debug] Segment 0 complete"
    const match = line.match(/Segment\s+(\d+)\s+complete/i);
    if (match) {
      const segmentNum = parseInt(match[1], 10);

      // 중복 방지: 이미 카운트한 세그먼트는 스킵 (재파싱 시)
      if (this.seenSegments.has(segmentNum)) {
        return null;
      }

      this.seenSegments.add(segmentNum);

      const now = Date.now();

      // 이 세그먼트 다운로드 실제 소요 시간
      const segmentDownloadTime = (now - this.lastSegmentTime) / 1000;

      // 이상치 필터링 (초기화/정체 제외)
      if (segmentDownloadTime >= 0.5 && segmentDownloadTime <= 30) {
        this.totalSegmentDuration += segmentDownloadTime;
        this.segmentCount++;
        this.avgSegmentDuration = this.totalSegmentDuration / this.segmentCount;
      } else {
        // 이상치도 현재 평균값으로 카운트 (progress 멈춤 방지)
        this.segmentCount++;
        this.totalSegmentDuration += this.avgSegmentDuration;
        // avgSegmentDuration은 재계산 안 함 (이상치 영향 최소화)
      }

      this.lastSegmentTime = now;
      return this.calculateProgress();
    }

    return null;
  }

  /**
   * Progress 계산 (0-100)
   *
   * 실제 다운로드된 시간 기반으로 progress를 계산합니다.
   * 예측이 아닌 실제 데이터만 사용하여 안정적인 진행도를 제공합니다.
   */
  calculateProgress() {
    if (this.segmentCount === 0) {
      return 0;
    }

    // 실제 다운로드된 시간 기반 계산 (예측 없음)
    const downloadedDuration = this.segmentCount * this.avgSegmentDuration;

    // Progress = 다운로드된 시간 / 목표 시간
    const rawProgress = Math.min(
      100,
      (downloadedDuration / this.targetDuration) * 100
    );

    // 지수 평활화 (alpha = 1.0 = 평활화 없음, 순수 실제 데이터)
    const alpha = StreamlinkProgressParser.SMOOTHING_ALPHA;
    this.smoothedProgress = (1 - alpha) * this.smoothedProgress + alpha * rawProgress;

    return this.smoothedProgress;
  }

  /**
   * 현재 progress 반환
   */
  getProgress() {
    return this.calculateProgress();
  }

  /**
   * Segment 카운트 반환
   */
  getSegmentCount() {
    return this.segmentCount;
  }

  /**
   * 다운로드된 시간 반환 (세그먼트 기반 재계산)
   */
  getDownloadedSeconds() {
    return this.segmentCount * this.avgSegmentDuration;
  }
}

/**
 * Streamlink progress tracker (FFprobe 기반 - 백업용)
 *
 * 1초마다 FFprobe 실행, 100ms 호출에는 캐시 반환
 */
class StreamlinkProgressTracker {
  constructor(
    tempFilePath,
    targetDuration,
    probeIntervalMs = 1000
  ) {
    this.tempFilePath = tempFilePath;
    this.targetDuration = targetDuration;
    this.probeIntervalMs = probeIntervalMs;
    this.cachedProgress = 0;
    this.lastProbeTime = 0;
    this.isProbing = false;
  }

  /**
   * Progress 계산 (0-100)
   *
   * 1초마다만 FFprobe 실행, 그 외에는 캐시 반환
   */
  async getProgress() {
    const now = Date.now();

    // 1초마다만 FFprobe 실행
    if (!this.isProbing && now - this.lastProbeTime >= this.probeIntervalMs) {
      this.isProbing = true;
      try {
        const currentDuration = await getFileDuration(this.tempFilePath);
        if (currentDuration > 0) {
          this.cachedProgress = Math.max(
            this.cachedProgress,
            calculateProgress(currentDuration, this.targetDuration)
          );
        }
      } catch (error) {
        console.error('[progressParser] FFprobe error:', error);
      } finally {
        this.isProbing = false;
      }
      this.lastProbeTime = now;
    }

    // 100ms 호출에는 캐시 반환
    return this.cachedProgress;
  }

  /**
   * 캐시 초기화
   */
  reset() {
    this.cachedProgress = 0;
    this.lastProbeTime = 0;
    this.isProbing = false;
  }
}

class FFmpegProgressTracker {
  constructor(totalDuration) {
    this.totalDuration = totalDuration;
    this.progress = 0;
    this.processedSeconds = 0;
    this.buffer = '';
  }

  updateProcessedSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }

    this.processedSeconds = Math.max(this.processedSeconds, seconds);
    this.progress = Math.max(
      this.progress,
      calculateProgress(this.processedSeconds, this.totalDuration)
    );
  }

  /**
   * Parse FFmpeg progress chunk from stderr/stdout.
   * Supports:
   * - key-value mode (-progress pipe:2): out_time_ms / out_time / progress=end
   * - legacy log mode: "... time=00:00:05.23 ..."
   */
  pushChunk(chunk) {
    if (chunk == null) {
      return this.progress;
    }

    this.buffer += chunk.toString();
    const lines = this.buffer.split(/[\r\n]+/);
    this.buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (line.startsWith('out_time_ms=')) {
        const value = parseInt(line.slice('out_time_ms='.length), 10);
        if (!Number.isNaN(value)) {
          this.updateProcessedSeconds(value / 1000000);
        }
        continue;
      }

      if (line.startsWith('out_time=')) {
        const parsed = parseFlexibleDuration(line.slice('out_time='.length));
        if (parsed != null) {
          this.updateProcessedSeconds(parsed);
        }
        continue;
      }

      if (line === 'progress=end') {
        this.progress = 100;
        this.processedSeconds = Math.max(
          this.processedSeconds,
          this.totalDuration
        );
        continue;
      }

      const parsedLegacy = parseFFmpegProgress(line, this.totalDuration);
      if (parsedLegacy > 0) {
        this.progress = Math.max(this.progress, parsedLegacy);
      }
    }

    return this.progress;
  }

  getProgress() {
    return this.progress;
  }

  getProcessedSeconds() {
    return this.processedSeconds;
  }
}

/**
 * FFmpeg stderr에서 progress 파싱
 *
 * @param {string} stderr - FFmpeg stderr 출력
 * @param {number} totalDuration - 전체 duration (초 단위)
 * @returns {number} progress (0-100)
 */
function parseFFmpegProgress(stderr, totalDuration) {
  // time=00:01:23.45 형식 파싱 (마지막 값 우선)
  const allMatches = [...stderr.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
  if (allMatches.length === 0) {
    return 0;
  }

  const [, hours, minutes, seconds] = allMatches[allMatches.length - 1];
  const currentTime =
    parseInt(hours, 10) * 3600 +
    parseInt(minutes, 10) * 60 +
    parseFloat(seconds);

  return calculateProgress(currentTime, totalDuration);
}

module.exports = {
  calculateProgress,
  parseFlexibleDuration,
  parseStreamlinkProgressLine,
  getFileDuration,
  StreamlinkProgressParser,
  StreamlinkProgressTracker,
  FFmpegProgressTracker,
  parseFFmpegProgress,
};
