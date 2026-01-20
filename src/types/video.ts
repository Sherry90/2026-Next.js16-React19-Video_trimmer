export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  frameRate: number;
  codec: string;
}

export interface VideoConstraints {
  maxSize: number;      // bytes
  supportedFormats: string[];
}
