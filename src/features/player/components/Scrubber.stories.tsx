import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Scrubber } from './Scrubber';

const meta: Meta<typeof Scrubber> = {
  title: 'Player/Scrubber',
  component: Scrubber,
  tags: ['autodocs'],
  parameters: { backgrounds: { default: 'dark' } },
  args: { onScrubStart: fn(), onScrub: fn(), onScrubEnd: fn() },
  decorators: [
    (Story) => (
      <div style={{ width: 600 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Scrubber>;

export const Start: Story = { args: { currentTime: 0, duration: 300 } };
export const Mid: Story = { args: { currentTime: 150, duration: 300 } };
export const End: Story = { args: { currentTime: 285, duration: 300 } };
export const WithBuffer: Story = { args: { currentTime: 90, duration: 300, buffered: 180 } };
