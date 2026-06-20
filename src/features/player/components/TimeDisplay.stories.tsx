import type { Meta, StoryObj } from '@storybook/react';
import { TimeDisplay } from './TimeDisplay';

const meta: Meta<typeof TimeDisplay> = {
  title: 'Player/TimeDisplay',
  component: TimeDisplay,
  tags: ['autodocs'],
  parameters: { backgrounds: { default: 'dark' } },
};

export default meta;
type Story = StoryObj<typeof TimeDisplay>;

export const Default: Story = { args: { currentTime: 90, duration: 300 } };
export const Zero: Story = { args: { currentTime: 0, duration: 300 } };
export const Hours: Story = { args: { currentTime: 3725, duration: 7200 } };
