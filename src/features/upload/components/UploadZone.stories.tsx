import type { Meta, StoryObj } from '@storybook/react';
import { UploadZone } from './UploadZone';

const meta: Meta<typeof UploadZone> = {
  title: 'Upload/UploadZone',
  component: UploadZone,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
    storeState: {
      phase: 'idle',
    },
  },
};

export default meta;
type Story = StoryObj<typeof UploadZone>;

export const Default: Story = {};
