import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { VolumeControl } from './VolumeControl';

const meta: Meta<typeof VolumeControl> = {
  title: 'Player/VolumeControl',
  component: VolumeControl,
  tags: ['autodocs'],
  parameters: { backgrounds: { default: 'dark' } },
  args: { onVolumeChange: fn(), onMuteToggle: fn() },
};

export default meta;
type Story = StoryObj<typeof VolumeControl>;

export const Full: Story = { args: { volume: 1, isMuted: false } };
export const Half: Story = { args: { volume: 0.5, isMuted: false } };
export const Muted: Story = { args: { volume: 0.5, isMuted: true } };
