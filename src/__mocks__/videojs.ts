// video.js 전체를 no-op mock으로 교체
const mockPlayer = {
  on: () => {},
  off: () => {},
  dispose: () => {},
  currentTime: () => 0,
  duration: () => 0,
  play: () => Promise.resolve(),
  pause: () => {},
  paused: () => true,
  seeking: () => false,
  isDisposed: () => false,
  src: () => {},
  ready: (cb: () => void) => cb(),
};

const videojs = () => mockPlayer;
videojs.getPlayer = () => null;
videojs.log = { warn: () => {} };

export default videojs;
