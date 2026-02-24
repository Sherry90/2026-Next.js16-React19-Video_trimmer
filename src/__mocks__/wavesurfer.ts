// wavesurfer.js를 no-op mock으로 교체
const WaveSurfer = {
  create: () => ({
    on: () => {},
    destroy: () => {},
    zoom: () => {},
    load: () => {},
  }),
};

export default WaveSurfer;
