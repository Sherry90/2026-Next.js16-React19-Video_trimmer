import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export interface TrimOptions {
  inputFile: File;
  startTime: number;  // 초 단위
  endTime: number;    // 초 단위
  onProgress?: (progress: number) => void; // 0-100
}

export async function trimVideo(
  ffmpeg: FFmpeg,
  options: TrimOptions
): Promise<Blob> {
  const { inputFile, startTime, endTime, onProgress } = options;

  try {
    // Progress 초기화
    onProgress?.(0);

    // 입력 파일을 FFmpeg 파일 시스템에 쓰기
    const inputFileName = 'input' + getFileExtension(inputFile.name);
    await ffmpeg.writeFile(inputFileName, await fetchFile(inputFile));

    onProgress?.(20);

    // 출력 파일명
    const outputFileName = 'output' + getFileExtension(inputFile.name);

    // FFmpeg 명령 실행
    // -i: 입력 파일
    // -ss: 시작 시간
    // -to: 종료 시간
    // -c copy: 재인코딩 없이 스트림 복사 (빠르고 품질 손실 없음)
    await ffmpeg.exec([
      '-i',
      inputFileName,
      '-ss',
      startTime.toString(),
      '-to',
      endTime.toString(),
      '-c',
      'copy',
      outputFileName,
    ]);

    onProgress?.(80);

    // 출력 파일 읽기
    const data = await ffmpeg.readFile(outputFileName);

    onProgress?.(90);

    // Blob 생성 (Uint8Array로 변환)
    const uint8Array = new Uint8Array(data as Uint8Array);
    const blob = new Blob([uint8Array], { type: inputFile.type });

    onProgress?.(100);

    // 임시 파일 삭제
    try {
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(outputFileName);
    } catch (error) {
      console.warn('Failed to delete temporary files:', error);
    }

    return blob;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Video trimming failed: ${errorMessage}`);
  }
}

function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return '.mp4'; // 기본값
  }
  return filename.substring(lastDotIndex);
}
