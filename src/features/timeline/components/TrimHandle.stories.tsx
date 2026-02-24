import type { Meta, StoryObj } from '@storybook/react';
import { TrimHandle } from './TrimHandle';

const meta: Meta<typeof TrimHandle> = {
  title: 'Timeline/TrimHandle',
  component: TrimHandle,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: '600px', height: '80px', background: '#1c1d20' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TrimHandle>;

const baseVideoFile = {
  file: null,
  source: 'url' as const,
  name: 'video.mp4',
  size: 0,
  type: 'video/mp4',
  url: 'blob:http://localhost:6006/fake',
  duration: 300,
};

export const InPoint: Story = {
  args: { type: 'in' },
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
      timeline: {
        inPoint: 60,
        outPoint: 240,
        playhead: 60,
        isInPointLocked: false,
        isOutPointLocked: false,
        zoom: 1,
      },
    },
  },
};

export const OutPoint: Story = {
  args: { type: 'out' },
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
      timeline: {
        inPoint: 60,
        outPoint: 240,
        playhead: 60,
        isInPointLocked: false,
        isOutPointLocked: false,
        zoom: 1,
      },
    },
  },
};

export const InPointLocked: Story = {
  args: { type: 'in' },
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
      timeline: {
        inPoint: 30,
        outPoint: 270,
        playhead: 30,
        isInPointLocked: true,
        isOutPointLocked: false,
        zoom: 1,
      },
    },
  },
};
