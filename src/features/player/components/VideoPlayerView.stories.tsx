import type { Meta, StoryObj } from '@storybook/react';
import { VideoPlayerView } from './VideoPlayerView';

const meta: Meta<typeof VideoPlayerView> = {
  title: 'Player/VideoPlayerView',
  component: VideoPlayerView,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export default meta;
type Story = StoryObj<typeof VideoPlayerView>;

export const WithVideo: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: {
        file: null,
        source: 'url' as const,
        name: 'sample-video.mp4',
        size: 0,
        type: 'video/mp4',
        url: 'https://www.w3schools.com/html/mov_bbb.mp4',
        duration: 10,
      },
    },
  },
};

export const NoVideo: Story = {
  parameters: {
    storeState: {
      phase: 'idle',
      videoFile: null,
    },
  },
};
