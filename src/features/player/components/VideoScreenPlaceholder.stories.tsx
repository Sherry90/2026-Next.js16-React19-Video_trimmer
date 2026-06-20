import type { Meta, StoryObj } from '@storybook/react';
import { VideoScreenPlaceholder } from './VideoScreenPlaceholder';

const meta: Meta<typeof VideoScreenPlaceholder> = {
  title: 'Player/VideoScreenPlaceholder',
  component: VideoScreenPlaceholder,
  tags: ['autodocs'],
  parameters: { backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <div style={{ width: 640 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VideoScreenPlaceholder>;

export const Default: Story = {};
export const Loading: Story = { args: { label: 'Loading video…' } };
