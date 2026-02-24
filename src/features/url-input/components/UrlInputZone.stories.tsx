import type { Meta, StoryObj } from '@storybook/react';
import { UrlInputZone } from './UrlInputZone';

const meta: Meta<typeof UrlInputZone> = {
  title: 'UrlInput/UrlInputZone',
  component: UrlInputZone,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
    storeState: {
      phase: 'idle',
    },
  },
};

export default meta;
type Story = StoryObj<typeof UrlInputZone>;

export const Default: Story = {};
