import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { ErrorDisplay } from './ErrorDisplay';
import type { AppError } from '@/types/types';

const meta: Meta<typeof ErrorDisplay> = {
  title: 'Export/ErrorDisplay',
  component: ErrorDisplay,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorDisplay>;

const processingError: AppError = {
  code: 'PROCESSING_FAILED',
  message: 'FFmpeg exited with code 1',
  userMessage: '영상 처리 중 오류가 발생했습니다.',
  solution: '다른 형식의 파일로 시도해 보세요.',
  technicalDetails: 'Error: FFmpeg process exited with code 1\n  at trim (/src/lib/ffmpeg.ts:42)',
};

const memoryError: AppError = {
  code: 'MEMORY_INSUFFICIENT',
  message: 'Out of memory',
  userMessage: '메모리가 부족합니다.',
  solution: '더 작은 파일을 사용하거나 브라우저 탭을 닫고 다시 시도하세요.',
};

const unknownError: AppError = {
  code: 'UNKNOWN',
  message: 'Unexpected error',
  userMessage: '알 수 없는 오류가 발생했습니다.',
};

export const ProcessingFailed: Story = {
  args: {
    error: processingError,
    onRetry: fn(),
  },
};

export const MemoryInsufficient: Story = {
  args: {
    error: memoryError,
    onRetry: fn(),
    onDismiss: fn(),
  },
};

export const Unknown: Story = {
  args: {
    error: unknownError,
    onRetry: fn(),
  },
};

// Via store error state
export const ViaStore: Story = {
  parameters: {
    storeState: {
      phase: 'error',
      error: {
        hasError: true,
        errorMessage: '파일을 처리할 수 없습니다. 파일이 손상되었을 수 있습니다.',
        errorCode: 'FILE_CORRUPTED',
      },
    },
  },
};
