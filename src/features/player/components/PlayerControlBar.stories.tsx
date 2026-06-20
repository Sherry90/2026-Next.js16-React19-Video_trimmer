import type { Meta, StoryObj } from '@storybook/react';
import { useRef } from 'react';
import { fn } from '@storybook/test';
import { PlayerControlBar } from './PlayerControlBar';
import { VideoPlayerProvider } from '@/features/player/context/VideoPlayerContext';

// 결선된 컨트롤바를 디자인 시스템 카드로 노출. video.js player는 null mock이라
// 품질 메뉴는 숨김(단일 화질 영상과 동일). 나머지(재생/스크럽/시간/볼륨/전체화면)는
// 주입된 store 상태로 동작. 카드 표시는 storeState가 구동한다.
const mockCtx = {
  player: null,
  play: fn(),
  pause: fn(),
  seek: fn(),
  togglePlay: fn(),
  setIsScrubbing: fn(),
};

function Demo() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ width: 760 }}>
      <PlayerControlBar wrapperRef={ref} />
    </div>
  );
}

const meta: Meta<typeof PlayerControlBar> = {
  title: 'Player/PlayerControlBar',
  component: PlayerControlBar,
  tags: ['autodocs'],
  parameters: { backgrounds: { default: 'dark' } },
  decorators: [
    (Story) => (
      <VideoPlayerProvider value={mockCtx}>
        <Story />
      </VideoPlayerProvider>
    ),
  ],
  render: () => <Demo />,
};

export default meta;
type Story = StoryObj<typeof PlayerControlBar>;

const baseVideoFile = {
  file: null,
  source: 'url' as const,
  name: 'video.mp4',
  size: 0,
  type: 'video/mp4',
  url: 'blob:http://localhost:6006/fake',
  duration: 300,
};
const baseTimeline = {
  inPoint: 0,
  outPoint: 300,
  playhead: 90,
  isInPointLocked: false,
  isOutPointLocked: false,
  zoom: 1,
};

export const Default: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
      player: { currentTime: 90, isPlaying: false, volume: 0.8, isMuted: false, isScrubbing: false },
      timeline: baseTimeline,
    },
  },
};

export const Playing: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
      player: { currentTime: 150, isPlaying: true, volume: 1, isMuted: false, isScrubbing: false },
      timeline: { ...baseTimeline, playhead: 150 },
    },
  },
};

export const Muted: Story = {
  parameters: {
    storeState: {
      phase: 'editing',
      videoFile: baseVideoFile,
      player: { currentTime: 30, isPlaying: false, volume: 0.5, isMuted: true, isScrubbing: false },
      timeline: { ...baseTimeline, playhead: 30 },
    },
  },
};
