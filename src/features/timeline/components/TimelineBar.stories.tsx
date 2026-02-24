import type { Meta, StoryObj } from '@storybook/react';
import { TimelineBar } from './TimelineBar';

const meta: Meta<typeof TimelineBar> = {
  title: 'Timeline/TimelineBar',
  component: TimelineBar,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export default meta;
type Story = StoryObj<typeof TimelineBar>;

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

export const NarrowSelection: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
      timeline: {
        inPoint: 130,
        outPoint: 170,
        playhead: 140,
        isInPointLocked: false,
        isOutPointLocked: false,
        zoom: 1,
      },
    },
  },
};

export const FullRange: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
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
