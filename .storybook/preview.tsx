import type { Preview } from '@storybook/react';
import { useStore } from '@/stores/useStore';
import './storybook.css';

const preview: Preview = {
  decorators: [
    (Story, context) => {
      // 스토리 간 상태 오염 방지: 먼저 초기값으로 리셋 후 override
      useStore.getState().reset();
      const storeState = context.parameters.storeState;
      if (storeState) {
        useStore.setState(storeState);
      }
      return <Story />;
    },
  ],
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#101114' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
};

export default preview;
