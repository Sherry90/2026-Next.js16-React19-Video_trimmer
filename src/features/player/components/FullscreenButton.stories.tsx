import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { FullscreenButton } from './FullscreenButton';

const meta: Meta<typeof FullscreenButton> = {
  title: 'Player/FullscreenButton',
  component: FullscreenButton,
  tags: ['autodocs'],
  parameters: { backgrounds: { default: 'dark' } },
  args: { onToggle: fn() },
};

export default meta;
type Story = StoryObj<typeof FullscreenButton>;

export const Windowed: Story = { args: { isFullscreen: false } };
export const Fullscreen: Story = { args: { isFullscreen: true } };
