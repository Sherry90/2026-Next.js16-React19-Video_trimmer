import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Playhead } from './Playhead';
import { VideoPlayerProvider } from '@/features/player/context/VideoPlayerContext';

const mockContextValue = {
  player: null,
  play: fn(),
  pause: fn(),
  seek: fn(),
  togglePlay: fn(),
  setIsScrubbing: fn(),
};

const meta: Meta<typeof Playhead> = {
  title: 'Timeline/Playhead',
  component: Playhead,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <VideoPlayerProvider value={mockContextValue}>
        <div style={{ position: 'relative', width: '600px', height: '80px', background: '#1c1d20' }}>
          <Story />
        </div>
      </VideoPlayerProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Playhead>;

const baseVideoFile = {
  file: null,
  source: 'url' as const,
  name: 'video.mp4',
  size: 0,
  type: 'video/mp4',
  url: 'blob:http://localhost:6006/fake',
  duration: 300,
};

export const AtStart: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
      player: {
        currentTime: 0,
        isPlaying: false,
        volume: 1,
        isMuted: false,
        isScrubbing: false,
      },
      timeline: {
        inPoint: 0,
        outPoint: 300,
        playhead: 0,
        isInPointLocked: false,
        isOutPointLocked: false,
        zoom: 1,
      },
    },
  },
};

export const InMiddle: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
      player: {
        currentTime: 150,
        isPlaying: false,
        volume: 1,
        isMuted: false,
        isScrubbing: false,
      },
      timeline: {
        inPoint: 60,
        outPoint: 240,
        playhead: 150,
        isInPointLocked: false,
        isOutPointLocked: false,
        zoom: 1,
      },
    },
  },
};
