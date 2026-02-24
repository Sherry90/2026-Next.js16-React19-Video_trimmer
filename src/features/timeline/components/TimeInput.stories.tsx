import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { TimeInput } from './TimeInput';

const meta: Meta<typeof TimeInput> = {
  title: 'Timeline/TimeInput',
  component: TimeInput,
  tags: ['autodocs'],
  args: {
    onChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof TimeInput>;

export const Default: Story = {
  args: {
    label: 'In Point',
    value: 150,
  },
};

export const OutPoint: Story = {
  args: {
    label: 'Out',
    value: 310.5,
  },
};

export const WithError: Story = {
  args: {
    label: 'In Point',
    value: 150,
    error: true,
  },
};

export const Disabled: Story = {
  args: {
    label: 'In Point',
    value: 90,
    disabled: true,
  },
};

export const NullValue: Story = {
  args: {
    label: 'In Point',
    value: null,
    placeholder: '00:00:00.000',
  },
};
