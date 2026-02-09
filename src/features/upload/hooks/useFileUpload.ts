import { useCallback } from 'react';
import { useStore } from '@/stores/useStore';
import { validateFile } from '@/features/upload/utils/validateFile';
import type { VideoFile } from '@/types/store';

export function useFileUpload() {
  const setVideoFile = useStore((state) => state.setVideoFile);
  const setPhase = useStore((state) => state.setPhase);
  const setErrorAndTransition = useStore((state) => state.setErrorAndTransition);
  const setUploadProgress = useStore((state) => state.setUploadProgress);

  const handleFileSelect = useCallback(
    async (file: File) => {
      // 파일 검증
      const validation = validateFile(file);
      if (!validation.isValid) {
        setErrorAndTransition(
          validation.error || 'Unknown validation error',
          'VALIDATION_ERROR'
        );
        return;
      }

      // 경고가 있으면 콘솔에 표시 (처리는 계속)
      if (validation.warning) {
        console.warn('[File Size Warning]', validation.warning);
        // TODO: UI에 경고 메시지 표시 (선택사항)
      }

      // 업로드 시작
      setPhase('uploading');
      setUploadProgress(0);

      try {
        // 파일 URL 생성 (즉시 완료)
        const url = URL.createObjectURL(file);

        // VideoFile 객체 생성
        const videoFile: VideoFile = {
          file,
          source: 'file',
          name: file.name,
          size: file.size,
          type: file.type,
          url,
          duration: 0, // 나중에 비디오 로드 시 설정
        };

        setVideoFile(videoFile);
        setUploadProgress(100);

        // 편집 단계로 전환 (FFmpeg 불필요)
        setPhase('editing');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'File upload failed';
        setErrorAndTransition(errorMessage, 'UPLOAD_ERROR');
      }
    },
    [setVideoFile, setPhase, setErrorAndTransition, setUploadProgress]
  );

  return {
    handleFileSelect,
  };
}
