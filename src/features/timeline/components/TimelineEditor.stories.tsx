import type { Meta, StoryObj } from '@storybook/react';
import { TimelineEditor } from './TimelineEditor';
import { VideoPlayerProvider } from '@/shared/video-player/VideoPlayerContext';
import { mockVideoPlayerContext } from '@/shared/video-player/videoPlayerContextMock';
import { PreviewPlaybackProvider } from '../context/PreviewPlaybackContext';

const meta: Meta<typeof TimelineEditor> = {
  title: 'Timeline/TimelineEditor',
  component: TimelineEditor,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <VideoPlayerProvider value={mockVideoPlayerContext}>
        <PreviewPlaybackProvider>
          <div style={{ width: '800px' }}>
            <Story />
          </div>
        </PreviewPlaybackProvider>
      </VideoPlayerProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TimelineEditor>;

const baseVideoFile = {
  file: null,
  source: 'url' as const,
  name: 'video.mp4',
  size: 0,
  type: 'video/mp4',
  url: 'blob:http://localhost:6006/fake',
  duration: 300,
};

export const Default: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
      player: {
        currentTime: 90,
        isPlaying: false,
        volume: 1,
        isMuted: false,
        isScrubbing: false,
      },
      timeline: {
        inPoint: 60,
        outPoint: 240,
        playhead: 90,
        isInPointLocked: false,
        isOutPointLocked: false,
        zoom: 1,
      },
    },
  },
};

export const BothLocked: Story = {
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
        inPoint: 30,
        outPoint: 270,
        playhead: 0,
        isInPointLocked: true,
        isOutPointLocked: true,
        zoom: 1,
      },
    },
  },
};
