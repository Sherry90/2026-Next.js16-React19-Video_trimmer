import type { Meta, StoryObj } from '@storybook/react';
import { UploadProgress } from './UploadProgress';

const meta: Meta<typeof UploadProgress> = {
  title: 'Upload/UploadProgress',
  component: UploadProgress,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof UploadProgress>;

const processingState = {
  trimProgress: 0,
  waveformProgress: 0,
  downloadPhase: null,
  downloadMessage: null,
  activeDownloadJobId: null,
};

export const InProgress: Story = {
  parameters: {
    storeState: {
      phase: 'uploading',
      processing: { ...processingState, uploadProgress: 65 },
      videoFile: {
        file: null,
        source: 'file',
        name: 'my-video.mp4',
        size: 524_288_000, // 500MB
        type: 'video/mp4',
        url: 'blob:http://localhost:6006/fake',
        duration: 0,
      },
    },
  },
};

export const AlmostDone: Story = {
  parameters: {
    storeState: {
      phase: 'uploading',
      processing: { ...processingState, uploadProgress: 95 },
      videoFile: {
        file: null,
        source: 'file',
        name: 'recording.mkv',
        size: 104_857_600, // 100MB
        type: 'video/x-matroska',
        url: 'blob:http://localhost:6006/fake',
        duration: 0,
      },
    },
  },
};
