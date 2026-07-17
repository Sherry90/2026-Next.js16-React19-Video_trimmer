import { fn } from '@storybook/test';

/**
 * Storybook 전용 VideoPlayerContext mock.
 *
 * player=null(단일 화질 취급), 나머지 메서드는 no-op spy. connected 컨트롤을
 * VideoPlayerProvider로 감쌀 때 주입한다. 프로덕션 코드에서 import 금지(@storybook/test 의존).
 */
export const mockVideoPlayerContext = {
  player: null,
  play: fn(),
  pause: fn(),
  seek: fn(),
  togglePlay: fn(),
  setIsScrubbing: fn(),
};
