import { toPercentage } from '@/shared/lib/mathUtils';

function calculateProgress(processedSeconds: number, totalDuration: number): number {
  return toPercentage(processedSeconds, totalDuration);
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

  pushChunk(chunk: Buffer | string): number {
    if (chunk == null) return this.progress;

    this.buffer += typeof chunk === 'string' ? chunk : chunk.toString();
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

/**
 * yt-dlp 진행률 파서
 *
 * yt-dlp의 --newline 플래그 출력에서 진행률을 추출합니다.
 * 형식: "[download] 45.2% of 123.45MiB at 1.23MiB/s ETA 00:12"
 */
class YtdlpProgressParser {
  private lastProgress = 0;

  /**
   * yt-dlp 출력 라인을 파싱하여 진행률 반환
   *
   * @param line - yt-dlp stdout/stderr 라인
   * @returns 진행률 (0-100) 또는 null (파싱 실패)
   */
  parseLine(line: string): number | null {
    if (!line) return null;

    // yt-dlp 진행률 형식: "[download] 45.2% of 123.45MiB at 1.23MiB/s ETA 00:12"
    const percentMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
    if (percentMatch) {
      const progress = parseFloat(percentMatch[1]);
      if (!isNaN(progress) && progress >= 0 && progress <= 100) {
        // 단조 증가 보장 (backwards progress 무시)
        this.lastProgress = Math.max(this.lastProgress, progress);
        return this.lastProgress;
      }
    }

    return null;
  }

  /**
   * 현재까지의 최대 진행률 반환
   */
  getProgress(): number {
    return this.lastProgress;
  }
}

export {
  parseFlexibleDuration,
  FFmpegProgressTracker,
  parseFFmpegProgress,
  YtdlpProgressParser,
};
