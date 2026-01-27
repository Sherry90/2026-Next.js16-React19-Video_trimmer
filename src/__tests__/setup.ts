import '@testing-library/jest-dom';

// Mock video.js
vi.mock('video.js', () => ({
  default: vi.fn(),
  log: vi.fn(),
}));

// Mock wavesurfer.js
vi.mock('wavesurfer.js', () => ({
  default: {
    create: vi.fn(),
  },
}));

// Mock FFmpeg
vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: vi.fn(() => ({
    load: vi.fn(),
    writeFile: vi.fn(),
    exec: vi.fn(),
    readFile: vi.fn(),
    on: vi.fn(),
  })),
}));

vi.mock('@ffmpeg/util', () => ({
  fetchFile: vi.fn(),
  toBlobURL: vi.fn(),
}));
