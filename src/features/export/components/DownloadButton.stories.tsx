import type { Meta, StoryObj } from '@storybook/react';
import { DownloadButton } from './DownloadButton';

const meta: Meta<typeof DownloadButton> = {
  title: 'Export/DownloadButton',
  component: DownloadButton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DownloadButton>;

export const Default: Story = {
  parameters: {
    storeState: {
      phase: 'completed',
      export: {
        outputUrl: 'blob:http://localhost:6006/fake-video-url',
        outputFilename: 'video(02m30s-05m10s).mp4',
      },
    },
  },
};

export const NoExtension: Story = {
  parameters: {
    storeState: {
      phase: 'completed',
      export: {
        outputUrl: 'blob:http://localhost:6006/fake-video-url',
        outputFilename: 'video_without_extension',
      },
    },
  },
};

export const LongFilename: Story = {
  parameters: {
    storeState: {
      phase: 'completed',
      export: {
        outputUrl: 'blob:http://localhost:6006/fake-video-url',
        outputFilename: 'very_long_video_filename_that_might_overflow_the_input_field(00m00s-10m00s).mp4',
      },
    },
  },
};
