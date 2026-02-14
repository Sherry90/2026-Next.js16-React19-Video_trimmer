import {
  parseFlexibleDuration,
  parseStreamlinkProgressLine,
  parseFFmpegProgress,
  StreamlinkProgressParser,
  FFmpegProgressTracker,
} from '@/lib/progressParser';

describe('progressParser', () => {
  it('parses clock duration and unit duration', () => {
    expect(parseFlexibleDuration('00:01:30.50')).toBeCloseTo(90.5, 2);
    expect(parseFlexibleDuration('1m30s')).toBeCloseTo(90, 2);
  });

  it('parses streamlink progress from elapsed segment time', () => {
    const line = '[download] Written 12.3 MB (30s @ 3.2 MB/s)';
    expect(parseStreamlinkProgressLine(line, 60)).toBeCloseTo(50, 2);
  });

  it('ignores streamlink direct percent output without download context', () => {
    const line = '42.5%';
    expect(parseStreamlinkProgressLine(line, 60)).toBeNull();
  });

  it('parses percent output with download context', () => {
    const line = '[download] written 12MB 77.2% ETA 00:00:10';
    expect(parseStreamlinkProgressLine(line, 120)).toBeCloseTo(77.2, 2);
  });

  it('parses ansi percent output with download context', () => {
    const line = '\u001b[32m[download]\u001b[0m written 77.2% ETA 00:00:10';
    expect(parseStreamlinkProgressLine(line, 120)).toBeCloseTo(77.2, 2);
  });

  it('parses streamlink eta style output', () => {
    const line = '00:00:20 / ETA 00:00:40';
    expect(parseStreamlinkProgressLine(line, 120)).toBeCloseTo(33.33, 1);
  });

  it('uses latest ffmpeg time value from cumulative logs', () => {
    const logs = 'time=00:00:05.00\n...\ntime=00:00:08.00\n';
    expect(parseFFmpegProgress(logs, 10)).toBeCloseTo(80, 2);
  });

  it('parses ffmpeg -progress key/value output', () => {
    const tracker = new FFmpegProgressTracker(10);
    tracker.pushChunk('out_time_ms=5000000\nprogress=continue\n');
    expect(tracker.getProgress()).toBeCloseTo(50, 2);

    tracker.pushChunk('progress=end\n');
    expect(tracker.getProgress()).toBe(100);
  });

  describe('StreamlinkProgressParser', () => {
    it('parses HLS segment complete log', () => {
      const parser = new StreamlinkProgressParser(100);

      // Real Streamlink format: "Segment 0 complete"
      for (let i = 0; i < 10; i++) {
        const progress = parser.parseLine(`[stream.hls][debug] Segment ${i} complete`);
        expect(progress).toBeGreaterThanOrEqual(0);
      }

      expect(parser.getSegmentCount()).toBe(10);
      expect(parser.getProgress()).toBeGreaterThan(0);
    });

    it('parses DASH segment complete log', () => {
      const parser = new StreamlinkProgressParser(100);

      const progress = parser.parseLine('[stream.dash][debug] Segment 1916 complete');
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(parser.getSegmentCount()).toBe(1);
    });

    it('ignores segment initialization logs', () => {
      const parser = new StreamlinkProgressParser(100);

      // Initialization segments should be ignored (not actual video segments)
      const progress = parser.parseLine('[stream.hls][debug] Segment initialization 0 complete');
      expect(progress).toBeNull();
      expect(parser.getSegmentCount()).toBe(0);
    });

    it('ignores non-segment logs', () => {
      const parser = new StreamlinkProgressParser(100);

      const progress = parser.parseLine('[stream.hls][info] Opening stream: 1080p60 (hls)');
      expect(progress).toBeNull();
      expect(parser.getSegmentCount()).toBe(0);
    });

    it('calculates progress based on downloaded duration', () => {
      const parser = new StreamlinkProgressParser(100);

      for (let i = 0; i < 10; i++) {
        parser.parseLine(`[stream.hls][debug] Segment ${i} complete`);
      }

      // 10 segments, 6s avg → downloadedDuration = 10 * 6 = 60s
      // Progress = (60/100) * 100 = 60%
      // With alpha=1.0 (no smoothing), exact progress
      const progress = parser.getProgress();
      expect(progress).toBeCloseTo(60, 0); // 정확히 60% (±1)
    });

    it('tracks dynamic average segment duration', () => {
      const parser = new StreamlinkProgressParser(120);

      // Simulate segments with timing
      parser.parseLine('[stream.hls][debug] Segment 0 complete');

      // avgSegmentDuration should be defined and positive
      expect(parser.avgSegmentDuration).toBeDefined();
      expect(parser.avgSegmentDuration).toBeGreaterThan(0);
    });

    it('uses raw progress without smoothing (alpha=1.0)', () => {
      const parser = new StreamlinkProgressParser(100);

      for (let i = 0; i < 20; i++) {
        parser.parseLine(`[stream.hls][debug] Segment ${i} complete`);
      }

      const progress = parser.getProgress();

      // 20 segments * 6s = 120s, but capped at 100s = 100%
      expect(progress).toBe(100);
    });

    it('handles case-insensitive matching', () => {
      const parser = new StreamlinkProgressParser(100);

      const progress1 = parser.parseLine('[stream.hls][debug] SEGMENT 0 COMPLETE');
      const progress2 = parser.parseLine('[stream.hls][debug] Segment 1 Complete');

      expect(progress1).toBeGreaterThanOrEqual(0);
      expect(progress2).toBeGreaterThanOrEqual(0);
      expect(parser.getSegmentCount()).toBe(2);
    });

    it('handles outlier segments with current average', () => {
      const parser = new StreamlinkProgressParser(100);

      // Normal segment
      parser.parseLine('[stream.hls][debug] Segment 0 complete');
      const count1 = parser.getSegmentCount();
      const duration1 = parser.totalSegmentDuration;

      // Simulate outlier (very fast - < 0.5s)
      parser.lastSegmentTime = Date.now() - 100; // 0.1s ago
      parser.parseLine('[stream.hls][debug] Segment 1 complete');

      const count2 = parser.getSegmentCount();
      const duration2 = parser.totalSegmentDuration;

      // Segment count should increase
      expect(count2).toBe(count1 + 1);

      // Duration should increase by avgSegmentDuration (not 0.1s)
      expect(duration2).toBeGreaterThan(duration1);
      expect(duration2 - duration1).toBeCloseTo(parser.avgSegmentDuration, 1);
    });

    it('progress increases smoothly without jumps', () => {
      const parser = new StreamlinkProgressParser(100);
      const progressHistory: number[] = [];

      for (let i = 0; i < 20; i++) {
        const progress = parser.parseLine(`[stream.hls][debug] Segment ${i} complete`);
        if (progress !== null) {
          progressHistory.push(progress);
        }
      }

      // Check for no large jumps (max 15% increase between readings)
      for (let i = 1; i < progressHistory.length; i++) {
        const delta = progressHistory[i] - progressHistory[i - 1];
        expect(delta).toBeLessThan(15); // No sudden jumps
        expect(delta).toBeGreaterThanOrEqual(0); // Monotonic increase
      }
    });
  });
});
