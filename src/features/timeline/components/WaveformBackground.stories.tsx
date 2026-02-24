import type { Meta, StoryObj } from '@storybook/react';
import { WaveformBackground } from './WaveformBackground';

const meta: Meta<typeof WaveformBackground> = {
  title: 'Timeline/WaveformBackground',
  component: WaveformBackground,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '600px', height: '80px', position: 'relative' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof WaveformBackground>;

export const WithVideoFile: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: {
        file: null,
        source: 'url' as const,
        name: 'video.mp4',
        size: 0,
        type: 'video/mp4',
        url: 'https://www.w3schools.com/html/mov_bbb.mp4',
        duration: 10,
      },
      timeline: {
        inPoint: 0,
        outPoint: 10,
        playhead: 0,
        isInPointLocked: false,
        isOutPointLocked: false,
        zoom: 1,
      },
      processing: {
        uploadProgress: 0,
        trimProgress: 0,
        waveformProgress: 0,
        downloadPhase: null,
        downloadMessage: null,
        activeDownloadJobId: null,
      },
    },
  },
};

export const NoVideoFile: Story = {
  parameters: {
    storeState: {
      phase: 'idle',
      videoFile: null,
      processing: {
        uploadProgress: 0,
        trimProgress: 0,
        waveformProgress: 0,
        downloadPhase: null,
        downloadMessage: null,
        activeDownloadJobId: null,
      },
    },
  },
};
