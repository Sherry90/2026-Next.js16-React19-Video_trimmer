import { createFile } from 'mp4box';
import type { ISOFile, Track, Sample, MP4BoxBuffer } from 'mp4box';

// Movie type from mp4box
interface Movie {
  audioTracks: Track[];
  videoTracks: Track[];
  duration: number;
  timescale: number;
  isFragmented: boolean;
  isProgressive: boolean;
  brands: string[];
}

export interface TrimOptions {
  inputFile: File;
  startTime: number;  // seconds
  endTime: number;    // seconds
  onProgress?: (progress: number) => void; // 0-100
}

interface SampleData {
  samples: Sample[];
  trackId: number;
  info: Track;
}

export async function trimVideoMP4Box(options: TrimOptions): Promise<Blob> {
  const { inputFile, startTime, endTime, onProgress } = options;

  try {
    onProgress?.(0);

    // Step 1: Read input file
    const arrayBuffer = await inputFile.arrayBuffer();
    onProgress?.(10);

    // Step 2: Parse MP4 and extract samples
    const { info, tracksData } = await parseAndExtractSamples(arrayBuffer, startTime, endTime);
    onProgress?.(50);

    // Step 3: Create new MP4 with trimmed samples
    const blob = await createTrimmedMP4(info, tracksData, startTime, endTime);
    onProgress?.(100);

    return blob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Video trimming failed: ${errorMessage}`);
  }
}

async function parseAndExtractSamples(
  arrayBuffer: ArrayBuffer,
  startTime: number,
  endTime: number
): Promise<{ info: Movie; tracksData: Map<number, SampleData> }> {
  return new Promise((resolve, reject) => {
    const mp4boxfile = createFile();
    const tracksData = new Map<number, SampleData>();
    let info: Movie;

    mp4boxfile.onReady = (parsedInfo: Movie) => {
      info = parsedInfo;

      // Set extraction options for all tracks
      [...parsedInfo.videoTracks, ...parsedInfo.audioTracks].forEach(track => {
        tracksData.set(track.id, {
          samples: [],
          trackId: track.id,
          info: track,
        });

        // Extract all samples (we'll filter by time later)
        mp4boxfile.setExtractionOptions(track.id, null, { nbSamples: 100000 });
      });

      mp4boxfile.start();
    };

    mp4boxfile.onSamples = (trackId: number, user: any, samples: Sample[]) => {
      const trackData = tracksData.get(trackId);
      if (trackData) {
        trackData.samples.push(...samples);
      }
    };

    mp4boxfile.onError = (e: string) => {
      reject(new Error(`MP4 parsing error: ${e}`));
    };

    // Append buffer
    const mp4ArrayBuffer = arrayBuffer as MP4BoxBuffer;
    mp4ArrayBuffer.fileStart = 0;
    mp4boxfile.appendBuffer(mp4ArrayBuffer);
    mp4boxfile.flush();

    // Wait for extraction to complete
    setTimeout(() => {
      if (info && tracksData.size > 0) {
        // Filter samples by time range
        tracksData.forEach(trackData => {
          const timescale = trackData.info.timescale;
          const startDts = Math.floor(startTime * timescale);
          const endDts = Math.floor(endTime * timescale);

          // Filter samples and find nearest keyframe for start
          let firstKeyframeIndex = -1;
          for (let i = 0; i < trackData.samples.length; i++) {
            const sample = trackData.samples[i];
            if (sample.is_sync && sample.dts >= startDts) {
              firstKeyframeIndex = i;
              break;
            }
          }

          // If no keyframe found after start, use first keyframe before start
          if (firstKeyframeIndex === -1) {
            for (let i = trackData.samples.length - 1; i >= 0; i--) {
              const sample = trackData.samples[i];
              if (sample.is_sync && sample.dts <= startDts) {
                firstKeyframeIndex = i;
                break;
              }
            }
          }

          // Find last sample before or at end time
          let lastSampleIndex = -1;
          for (let i = trackData.samples.length - 1; i >= 0; i--) {
            const sample = trackData.samples[i];
            if (sample.dts <= endDts) {
              lastSampleIndex = i;
              break;
            }
          }

          // Extract trimmed samples
          if (firstKeyframeIndex !== -1 && lastSampleIndex !== -1 && firstKeyframeIndex <= lastSampleIndex) {
            trackData.samples = trackData.samples.slice(firstKeyframeIndex, lastSampleIndex + 1);
          } else {
            trackData.samples = [];
          }
        });

        resolve({ info, tracksData });
      } else {
        reject(new Error('Failed to parse MP4 or no tracks found'));
      }
    }, 2000); // Wait 2 seconds for samples to be extracted
  });
}

async function createTrimmedMP4(
  info: Movie,
  tracksData: Map<number, SampleData>,
  startTime: number,
  endTime: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mp4boxfile = createFile();

    try {
      // Add tracks
      const trackIdMap = new Map<number, number>(); // old track id -> new track id

      tracksData.forEach((trackData, oldTrackId) => {
        if (trackData.samples.length === 0) return;

        const track = trackData.info;
        const isVideo = info.videoTracks.some(t => t.id === oldTrackId);

        let trackOptions: any = {
          timescale: track.timescale,
          duration: Math.floor((endTime - startTime) * track.timescale),
          language: track.language || 'und',
          width: track.track_width || 0,
          height: track.track_height || 0,
        };

        if (isVideo) {
          trackOptions.type = 'video';
          trackOptions.avcDecoderConfigRecord = (track as any).codec_config || null;
        } else {
          trackOptions.type = 'audio';
          trackOptions.samplerate = (track as any).audio?.sample_rate || 48000;
          trackOptions.channel_count = (track as any).audio?.channel_count || 2;
          trackOptions.samplesize = (track as any).audio?.sample_size || 16;
        }

        const newTrackId = mp4boxfile.addTrack(trackOptions);
        trackIdMap.set(oldTrackId, newTrackId);
      });

      // Add samples
      tracksData.forEach((trackData, oldTrackId) => {
        const newTrackId = trackIdMap.get(oldTrackId);
        if (!newTrackId || trackData.samples.length === 0) return;

        const firstDts = trackData.samples[0].dts;

        trackData.samples.forEach((sample, index) => {
          if (!sample.data) return; // Skip samples without data

          const sampleOptions = {
            duration: sample.duration,
            dts: sample.dts - firstDts,
            cts: sample.cts - firstDts,
            is_sync: sample.is_sync,
          };

          mp4boxfile.addSample(newTrackId, sample.data, sampleOptions);
        });
      });

      // Save the file
      const blob = mp4boxfile.save('output.mp4');
      resolve(blob);
    } catch (error) {
      reject(error);
    }
  });
}
