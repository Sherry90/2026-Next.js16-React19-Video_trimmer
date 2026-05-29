import type { Meta, StoryObj } from '@storybook/react';
import { ProgressBar } from './ProgressBar';

const meta: Meta<typeof ProgressBar> = {
  title: 'Components/ProgressBar',
  component: ProgressBar,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProgressBar>;

export const Default: Story = {
  args: {
    progress: 60,
    label: 'Processing...',
  },
};

export const Complete: Story = {
  args: {
    progress: 100,
    label: 'Done',
  },
};

export const Empty: Story = {
  args: {
    progress: 0,
    label: 'Starting...',
  },
};

export const NoLabel: Story = {
  args: {
    progress: 45,
  },
};
