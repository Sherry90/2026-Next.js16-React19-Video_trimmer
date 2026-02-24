import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { TimelineControls } from './TimelineControls';

const meta: Meta<typeof TimelineControls> = {
  title: 'Timeline/TimelineControls',
  component: TimelineControls,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
  },
  args: {
    onInPointChange: fn(),
    onOutPointChange: fn(),
    onInPointLockToggle: fn(),
    onOutPointLockToggle: fn(),
    onPreviewEdges: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof TimelineControls>;

export const Default: Story = {
  args: {
    inPoint: 30,
    outPoint: 150,
    duration: 300,
    isInPointLocked: false,
    isOutPointLocked: false,
  },
};

export const BothLocked: Story = {
  args: {
    inPoint: 60,
    outPoint: 240,
    duration: 300,
    isInPointLocked: true,
    isOutPointLocked: true,
  },
};

export const InLocked: Story = {
  args: {
    inPoint: 10,
    outPoint: 200,
    duration: 300,
    isInPointLocked: true,
    isOutPointLocked: false,
  },
};

export const OutLocked: Story = {
  args: {
    inPoint: 10,
    outPoint: 200,
    duration: 300,
    isInPointLocked: false,
    isOutPointLocked: true,
  },
};
