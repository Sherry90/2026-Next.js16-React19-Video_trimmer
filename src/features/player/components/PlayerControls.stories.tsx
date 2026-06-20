import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { PlayerControls } from './PlayerControls';

const meta: Meta<typeof PlayerControls> = {
  title: 'Player/PlayerControls',
  component: PlayerControls,
  tags: ['autodocs'],
  parameters: { backgrounds: { default: 'dark' } },
  args: {
    onTogglePlay: fn(),
    onScrubStart: fn(),
    onScrub: fn(),
    onScrubEnd: fn(),
    onVolumeChange: fn(),
    onMuteToggle: fn(),
    onSelectQuality: fn(),
    onToggleFullscreen: fn(),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 760 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PlayerControls>;

const base = {
  currentTime: 90,
  duration: 300,
  buffered: 180,
  volume: 0.8,
  isMuted: false,
  qualityHeights: [1080, 720, 480],
  selectedQuality: 1080,
  isFullscreen: false,
};

export const Default: Story = { args: { ...base, isPlaying: false } };
export const Playing: Story = { args: { ...base, isPlaying: true } };
export const NoQuality: Story = { args: { ...base, isPlaying: false, qualityHeights: [], selectedQuality: null } };
