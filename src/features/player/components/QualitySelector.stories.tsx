import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { QualitySelector } from './QualitySelector';

const meta: Meta<typeof QualitySelector> = {
  title: 'Player/QualitySelector',
  component: QualitySelector,
  tags: ['autodocs'],
  parameters: { backgrounds: { default: 'dark' } },
  args: { onSelect: fn() },
  decorators: [
    (Story) => (
      <div style={{ minHeight: 180, display: 'flex', alignItems: 'flex-end' }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof QualitySelector>;

export const MultiLevel: Story = { args: { heights: [1080, 720, 480, 360], selected: 1080 } };
export const AutoSelected: Story = { args: { heights: [1080, 720, 480], selected: null } };
// 화질이 1개 이하면 숨김 — 빈 렌더(hide 동작 문서화)
export const SingleLevel: Story = { args: { heights: [720], selected: 720 } };
