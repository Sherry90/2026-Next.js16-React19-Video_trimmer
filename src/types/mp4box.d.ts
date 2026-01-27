// Type definitions for mp4box.js
declare module 'mp4box' {
  export interface MP4Info {
    duration: number;
    timescale: number;
    isFragmented: boolean;
    isProgressive: boolean;
    hasIOD: boolean;
    brands: string[];
    created: Date;
    modified: Date;
    tracks: MP4Track[];
    videoTracks: MP4VideoTrack[];
    audioTracks: MP4AudioTrack[];
  }

  export interface MP4Track {
    id: number;
    created: Date;
    modified: Date;
    movie_duration: number;
    layer: number;
    alternate_group: number;
    volume: number;
    track_width: number;
    track_height: number;
    timescale: number;
    duration: number;
    bitrate: number;
    codec: string;
    language: string;
    nb_samples: number;
  }

  export interface MP4VideoTrack extends MP4Track {
    video: {
      width: number;
      height: number;
    };
  }

  export interface MP4AudioTrack extends MP4Track {
    audio: {
      sample_rate: number;
      channel_count: number;
      sample_size: number;
    };
  }

  export interface MP4Sample {
    number: number;
    track_id: number;
    timescale: number;
    description_index: number;
    description: any;
    data: ArrayBuffer;
    size: number;
    alreadyRead: number;
    duration: number;
    cts: number;
    dts: number;
    is_sync: boolean;
    is_leading: number;
    depends_on: number;
    is_depended_on: number;
    has_redundancy: number;
    degradation_priority: number;
    offset: number;
    subsamples: any;
  }

  export interface MP4ArrayBuffer extends ArrayBuffer {
    fileStart: number;
  }

  export interface MP4File {
    onMoovStart?: () => void;
    onReady?: (info: MP4Info) => void;
    onError?: (e: string) => void;
    onSamples?: (id: number, user: any, samples: MP4Sample[]) => void;

    appendBuffer(data: MP4ArrayBuffer): number;
    start(): void;
    stop(): void;
    flush(): void;
    setExtractionOptions(
      id: number,
      user?: any,
      options?: { nbSamples?: number; rapAlignment?: boolean }
    ): void;

    // For muxing
    addTrack(trackOptions: any): number;
    addSample(trackId: number, sample: ArrayBuffer, sampleOptions: any): void;
    save(callback?: (buffer: ArrayBuffer) => void): ArrayBuffer;
  }

  export function createFile(): MP4File;

  export default {
    createFile,
  };
}
