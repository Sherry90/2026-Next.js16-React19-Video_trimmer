import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

/**
 * FFmpeg 싱글톤 관리 클래스
 *
 * FFmpeg.wasm 인스턴스를 세션 전반에 걸쳐 재사용
 * - 중복 다운로드 방지 (~20MB)
 * - 로딩 중 중복 요청 방지
 * - 메모리 관리 (cleanup)
 */
export class FFmpegSingleton {
  private static instance: FFmpeg | null = null;
  private static isLoading = false;
  private static loadPromise: Promise<FFmpeg> | null = null;

  /**
   * FFmpeg 인스턴스 가져오기 (싱글톤)
   *
   * @param onProgress - 로딩 진행률 콜백 (0-100)
   * @returns FFmpeg 인스턴스
   */
  static async getInstance(
    onProgress?: (progress: number) => void
  ): Promise<FFmpeg> {
    // Return existing instance if already loaded
    if (this.instance) {
      return this.instance;
    }

    // If already loading, wait for that promise
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    this.isLoading = true;
    this.loadPromise = this.load(onProgress);

    try {
      return await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  /**
   * FFmpeg 로드 (내부 메서드)
   */
  private static async load(
    onProgress?: (progress: number) => void
  ): Promise<FFmpeg> {
    try {
      onProgress?.(0);

      const ffmpeg = new FFmpeg();

      // Set up logging
      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      // Set up progress callback
      ffmpeg.on('progress', ({ progress }) => {
        // progress is 0-1, convert to 0-100
        onProgress?.(Math.round(progress * 100));
      });

      // Load FFmpeg core (~20MB download)
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      onProgress?.(100);

      this.instance = ffmpeg;
      return ffmpeg;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to load FFmpeg';
      console.error('FFmpeg load error:', error);
      throw new Error(errorMessage);
    }
  }

  /**
   * FFmpeg 인스턴스 정리 및 상태 초기화
   *
   * 애플리케이션 리셋 시 호출하여 메모리 확보
   */
  static cleanup(): void {
    if (this.instance) {
      // FFmpeg instance doesn't have explicit cleanup, but we can null it
      this.instance = null;
    }
    this.isLoading = false;
    this.loadPromise = null;
  }

  /**
   * FFmpeg 인스턴스가 로드되었는지 확인
   */
  static isLoaded(): boolean {
    return this.instance !== null;
  }

  /**
   * FFmpeg 인스턴스가 로딩 중인지 확인
   */
  static isLoadingNow(): boolean {
    return this.isLoading;
  }
}
