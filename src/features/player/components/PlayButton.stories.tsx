import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { PlayButton } from './PlayButton';

const meta: Meta<typeof PlayButton> = {
  title: 'Player/PlayButton',
  component: PlayButton,
  tags: ['autodocs'],
  parameters: { backgrounds: { default: 'dark' } },
  args: { onToggle: fn() },
};

export default meta;
type Story = StoryObj<typeof PlayButton>;

export const Paused: Story = { args: { isPlaying: false } };
export const Playing: Story = { args: { isPlaying: true } };
export const Disabled: Story = { args: { isPlaying: false, disabled: true } };
