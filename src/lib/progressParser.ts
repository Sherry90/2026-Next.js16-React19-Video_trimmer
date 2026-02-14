import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { getFfmpegPath } from './binPaths.cjs';
import { PROGRESS } from '@/constants/appConfig';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const stripAnsi = (input: string): string => typeof input === 'string' ? input.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '') : '';

function calculateProgress(processedSeconds: number, totalDuration: number): number {
  if (!Number.isFinite(processedSeconds) || processedSeconds < 0 || !Number.isFinite(totalDuration) || totalDuration <= 0) {
    return 0;
  }
  return clamp((processedSeconds / totalDuration) * 100, 0, 100);
}

function parseClockDuration(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (!match) return null;
  const [, hours, minutes, seconds] = match;
  return parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseFloat(seconds);
}

function parseUnitDuration(value: string): number | null {
  const compact = value.toLowerCase().replace(/\s+/g, '');
  const matches = [...compact.matchAll(/(\d+(?:\.\d+)?)(h|m|s)/g)];
  if (matches.length === 0) return null;

  const unitMap: Record<string, number> = { h: 3600, m: 60, s: 1 };
  let total = 0;
  for (const [, amount, unit] of matches) {
    const numeric = parseFloat(amount);
    if (!Number.isNaN(numeric)) total += numeric * (unitMap[unit] || 0);
  }
  return total > 0 ? total : null;
}

function parseFlexibleDuration(value: string): number | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const clock = parseClockDuration(trimmed);
  if (clock != null) return clock;

  const unit = parseUnitDuration(trimmed);
  if (unit != null) return unit;

  const secMatch = trimmed.match(/^(\d+(?:\.\d+)?)$/);
  return secMatch ? parseFloat(secMatch[1]) : null;
}

function parseStreamlinkProgressLine(line: string, targetDuration: number): number | null {
  if (!line || targetDuration <= 0) return null;
  const cleanedLine = stripAnsi(line);

  if (/download|written|eta|\/s|byte|kb|mb|gb/i.test(cleanedLine)) {
    const percentMatch = cleanedLine.match(/(\d{1,3}(?:\.\d+)?)%/);
    if (percentMatch) {
      const numeric = parseFloat(percentMatch[1]);
      if (!Number.isNaN(numeric)) return clamp(numeric, 0, 100);
    }
  }

  const parenthetical = [...cleanedLine.matchAll(/\(([^)]+)\)/g)];
  for (const [, raw] of parenthetical) {
    const candidate = raw.split('@')[0]?.trim();
    if (candidate) {
      const seconds = parseFlexibleDuration(candidate);
      if (seconds != null) return calculateProgress(seconds, targetDuration);
    }
  }

  const clockMatches = [...cleanedLine.matchAll(/\b\d{1,2}:\d{2}:\d{2}(?:\.\d+)?\b/g)];
  if (clockMatches.length > 0) {
    const candidate = clockMatches[clockMatches.length - 1][0];
    const seconds = parseFlexibleDuration(candidate);
    if (seconds != null) return calculateProgress(seconds, targetDuration);
  }

  const unitMatches = [...cleanedLine.matchAll(/\b(?:\d+(?:\.\d+)?h)?(?:\d+(?:\.\d+)?m)?(?:\d+(?:\.\d+)?s)\b/gi)];
  if (unitMatches.length > 0) {
    const candidate = unitMatches[unitMatches.length - 1][0];
    const seconds = parseFlexibleDuration(candidate);
    if (seconds != null) return calculateProgress(seconds, targetDuration);
  }

  return null;
}

function getFfprobePath(): string {
  try {
    execSync('which ffprobe', { stdio: 'ignore' });
    return 'ffprobe';
  } catch {
    const ffmpegPath = getFfmpegPath();
    const ffprobePath = join(dirname(ffmpegPath), 'ffprobe');
    return existsSync(ffprobePath) ? ffprobePath : 'ffprobe';
  }
}

async function getFileDuration(filePath: string): Promise<number> {
  if (!existsSync(filePath)) return 0;

  return new Promise((resolve) => {
    const proc = spawn(getFfprobePath(), [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stdout = '';
    proc.stdout?.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const duration = parseFloat(stdout.trim());
        if (!isNaN(duration)) return resolve(duration);
      }
      resolve(0);
    });
    proc.on('error', () => resolve(0));
  });
}

class StreamlinkProgressParser {
  static SMOOTHING_ALPHA = 1.0;
  targetDuration: number;
  segmentCount = 0;
  totalSegmentDuration = 0;
  avgSegmentDuration = 6;
  smoothedProgress = 0;
  lastSegmentTime: number;
  seenSegments = new Set<number>();

  constructor(targetDuration: number) {
    this.targetDuration = targetDuration;
    this.lastSegmentTime = Date.now();
  }

  parseLine(line: string): number | null {
    if (!line) return null;

    const match = line.match(/Segment\s+(\d+)\s+complete/i);
    if (!match) return null;

    const segmentNum = parseInt(match[1], 10);
    if (this.seenSegments.has(segmentNum)) return null;
    this.seenSegments.add(segmentNum);

    const now = Date.now();
    const segmentDownloadTime = (now - this.lastSegmentTime) / 1000;

    if (segmentDownloadTime >= PROGRESS.SEGMENT_MIN_TIME_SEC && segmentDownloadTime <= PROGRESS.SEGMENT_MAX_TIME_SEC) {
      this.totalSegmentDuration += segmentDownloadTime;
      this.segmentCount++;
      this.avgSegmentDuration = this.totalSegmentDuration / this.segmentCount;
    } else {
      this.segmentCount++;
      this.totalSegmentDuration += this.avgSegmentDuration;
    }

    this.lastSegmentTime = now;
    return this.calculateProgress();
  }

  calculateProgress(): number {
    if (this.segmentCount === 0) return 0;

    const downloadedDuration = this.segmentCount * this.avgSegmentDuration;
    const rawProgress = Math.min(100, (downloadedDuration / this.targetDuration) * 100);

    const alpha = StreamlinkProgressParser.SMOOTHING_ALPHA;
    this.smoothedProgress = (1 - alpha) * this.smoothedProgress + alpha * rawProgress;
    return this.smoothedProgress;
  }

  getProgress(): number { return this.calculateProgress(); }
  getSegmentCount(): number { return this.segmentCount; }
  getDownloadedSeconds(): number { return this.segmentCount * this.avgSegmentDuration; }
}

class StreamlinkProgressTracker {
  tempFilePath: string;
  targetDuration: number;
  probeIntervalMs: number;
  cachedProgress = 0;
  lastProbeTime = 0;
  isProbing = false;

  constructor(tempFilePath: string, targetDuration: number, probeIntervalMs = 1000) {
    this.tempFilePath = tempFilePath;
    this.targetDuration = targetDuration;
    this.probeIntervalMs = probeIntervalMs;
  }

  async getProgress(): Promise<number> {
    const now = Date.now();

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
      } finally {
        this.isProbing = false;
        this.lastProbeTime = now;
      }
    }

    return this.cachedProgress;
  }

  reset(): void {
    this.cachedProgress = 0;
    this.lastProbeTime = 0;
    this.isProbing = false;
  }
}

class FFmpegProgressTracker {
  totalDuration: number;
  progress = 0;
  processedSeconds = 0;
  buffer = '';

  constructor(totalDuration: number) {
    this.totalDuration = totalDuration;
  }

  private updateProcessedSeconds(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    this.processedSeconds = Math.max(this.processedSeconds, seconds);
    this.progress = Math.max(this.progress, calculateProgress(this.processedSeconds, this.totalDuration));
  }

  pushChunk(chunk: any): number {
    if (chunk == null) return this.progress;

    this.buffer += chunk.toString();
    const lines = this.buffer.split(/[\r\n]+/);
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('out_time_ms=')) {
        const value = parseInt(trimmed.slice(12), 10);
        if (!Number.isNaN(value)) this.updateProcessedSeconds(value / 1000000);
      } else if (trimmed.startsWith('out_time=')) {
        const parsed = parseFlexibleDuration(trimmed.slice(9));
        if (parsed != null) this.updateProcessedSeconds(parsed);
      } else if (trimmed === 'progress=end') {
        this.progress = 100;
        this.processedSeconds = Math.max(this.processedSeconds, this.totalDuration);
      } else {
        const parsedLegacy = parseFFmpegProgress(trimmed, this.totalDuration);
        if (parsedLegacy > 0) this.progress = Math.max(this.progress, parsedLegacy);
      }
    }

    return this.progress;
  }

  getProgress(): number { return this.progress; }
  getProcessedSeconds(): number { return this.processedSeconds; }
}

function parseFFmpegProgress(stderr: string, totalDuration: number): number {
  const allMatches = [...stderr.matchAll(/time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)];
  if (allMatches.length === 0) return 0;

  const [, hours, minutes, seconds] = allMatches[allMatches.length - 1];
  const currentTime = parseInt(hours, 10) * 3600 + parseInt(minutes, 10) * 60 + parseFloat(seconds);
  return calculateProgress(currentTime, totalDuration);
}

export {
  calculateProgress,
  parseFlexibleDuration,
  parseStreamlinkProgressLine,
  getFileDuration,
  StreamlinkProgressParser,
  StreamlinkProgressTracker,
  FFmpegProgressTracker,
  parseFFmpegProgress,
};
