import type { Meta, StoryObj } from '@storybook/react';
import { UrlPreviewCard } from './UrlPreviewCard';

const meta: Meta<typeof UrlPreviewCard> = {
  title: 'UrlInput/UrlPreviewCard',
  component: UrlPreviewCard,
  tags: ['autodocs'],
  parameters: {
    backgrounds: { default: 'dark' },
  },
};

export default meta;
type Story = StoryObj<typeof UrlPreviewCard>;

export const Default: Story = {
  args: {
    title: 'Sample YouTube Video - 10 Minutes of Coding',
    thumbnail: 'https://picsum.photos/seed/video/640/360',
    duration: 600,
    maxDuration: 600,
    isSegmentOverLimit: false,
  },
};

export const LongTitle: Story = {
  args: {
    title: 'This Is A Very Long Video Title That Should Be Clamped To Two Lines Because It Is So Long And Would Otherwise Overflow',
    thumbnail: 'https://picsum.photos/seed/long/640/360',
    duration: 3600,
    maxDuration: 600,
    isSegmentOverLimit: false,
  },
};

export const OverLimit: Story = {
  args: {
    title: '2 Hour Stream Highlight Compilation',
    thumbnail: 'https://picsum.photos/seed/stream/640/360',
    duration: 7200,
    maxDuration: 600,
    isSegmentOverLimit: true,
  },
};

export const NoThumbnail: Story = {
  args: {
    title: 'Video Without Thumbnail',
    duration: 180,
    maxDuration: 600,
    isSegmentOverLimit: false,
  },
};
