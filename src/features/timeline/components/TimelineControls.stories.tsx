import type { Meta, StoryObj } from '@storybook/react';
import { TimelineControls } from './TimelineControls';
import { VideoPlayerProvider } from '@/shared/video-player/VideoPlayerContext';
import { mockVideoPlayerContext } from '@/shared/video-player/videoPlayerContextMock';
import { PreviewPlaybackProvider } from '../context/PreviewPlaybackContext';

// connected 컨트롤: 스토어를 직접 소비한다. 표시는 storeState가 구동하고,
// preview는 PreviewPlaybackProvider(→ VideoPlayerContext)를 요구하므로 mock provider로 감싼다.
const meta: Meta<typeof TimelineControls> = {
  title: 'Timeline/TimelineControls',
  component: TimelineControls,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <VideoPlayerProvider value={mockVideoPlayerContext}>
        <PreviewPlaybackProvider>
          <Story />
        </PreviewPlaybackProvider>
      </VideoPlayerProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TimelineControls>;

const baseTimeline = {
  playhead: 0,
  zoom: 1,
};

export const Default: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: { duration: 300 },
      timeline: { ...baseTimeline, inPoint: 30, outPoint: 150, isInPointLocked: false, isOutPointLocked: false },
    },
  },
};

export const BothLocked: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: { duration: 300 },
      timeline: { ...baseTimeline, inPoint: 60, outPoint: 240, isInPointLocked: true, isOutPointLocked: true },
    },
  },
};

export const InLocked: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: { duration: 300 },
      timeline: { ...baseTimeline, inPoint: 10, outPoint: 200, isInPointLocked: true, isOutPointLocked: false },
    },
  },
};

export const OutLocked: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: { duration: 300 },
      timeline: { ...baseTimeline, inPoint: 10, outPoint: 200, isInPointLocked: false, isOutPointLocked: true },
    },
  },
};
