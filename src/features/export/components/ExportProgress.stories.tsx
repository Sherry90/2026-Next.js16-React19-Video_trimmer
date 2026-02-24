import type { Meta, StoryObj } from '@storybook/react';
import { ExportProgress } from './ExportProgress';

const meta: Meta<typeof ExportProgress> = {
  title: 'Export/ExportProgress',
  component: ExportProgress,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ExportProgress>;

const processingState = {
  uploadProgress: 0,
  waveformProgress: 0,
  downloadPhase: null,
  downloadMessage: null,
  activeDownloadJobId: null,
};

// source: 'file', file: null → component falls back to 'mp4box' label
// (File 객체 직렬화 불가로 null 사용)
export const FileSource: Story = {
  parameters: {
    storeState: {
      phase: 'processing',
      processing: { ...processingState, trimProgress: 42 },
      videoFile: {
        file: null,
        source: 'file',
        name: 'video.mp4',
        size: 10_000_000,
        type: 'video/mp4',
        url: 'blob:http://localhost:6006/fake',
        duration: 300,
      },
    },
  },
};

// source: 'url' → 컴포넌트가 'Server FFmpeg' 표시
export const UrlSource: Story = {
  parameters: {
    storeState: {
      phase: 'processing',
      processing: { ...processingState, trimProgress: 55 },
      videoFile: {
        file: null,
        source: 'url',
        name: 'youtube-video.mp4',
        size: 0,
        type: 'video/mp4',
        url: '/api/video/proxy?url=https://example.com',
        duration: 600,
      },
    },
  },
};

export const Starting: Story = {
  parameters: {
    storeState: {
      phase: 'processing',
      processing: { ...processingState, trimProgress: 0 },
      videoFile: {
        file: null,
        source: 'file',
        name: 'video.mp4',
        size: 50_000_000,
        type: 'video/mp4',
        url: 'blob:http://localhost:6006/fake',
        duration: 120,
      },
    },
  },
};

export const AlmostDone: Story = {
  parameters: {
    storeState: {
      phase: 'processing',
      processing: { ...processingState, trimProgress: 95 },
      videoFile: {
        file: null,
        source: 'file',
        name: 'video.mp4',
        size: 10_000_000,
        type: 'video/mp4',
        url: 'blob:http://localhost:6006/fake',
        duration: 300,
      },
    },
  },
};
