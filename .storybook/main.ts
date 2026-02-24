import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(config, {
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '../src'),
          'video.js': path.resolve(__dirname, '../src/__mocks__/videojs.ts'),
          'wavesurfer.js': path.resolve(__dirname, '../src/__mocks__/wavesurfer.ts'),
        },
      },
    });
  },
};

export default config;
