import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/stores/useStore';

describe('useStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useStore.getState().reset();
  });

  describe('Phase management', () => {
    it('should start with idle phase', () => {
      const { phase } = useStore.getState();
      expect(phase).toBe('idle');
    });

    it('should change phase', () => {
      const { setPhase } = useStore.getState();
      setPhase('uploading');
      expect(useStore.getState().phase).toBe('uploading');
    });
  });

  describe('Video file management', () => {
    it('should set video file', () => {
      const { setVideoFile } = useStore.getState();
      const mockFile = {
        file: new File(['test'], 'test.mp4'),
        source: 'file' as const,
        name: 'test.mp4',
        size: 1024,
        type: 'video/mp4',
        url: 'blob:test',
        duration: 100,
      };

      setVideoFile(mockFile);
      expect(useStore.getState().videoFile).toEqual(mockFile);
    });

    it('should set video duration and update outPoint', () => {
      const { setVideoFile, setVideoDuration } = useStore.getState();
      const mockFile = {
        file: new File(['test'], 'test.mp4'),
        source: 'file' as const,
        name: 'test.mp4',
        size: 1024,
        type: 'video/mp4',
        url: 'blob:test',
        duration: 0,
      };

      setVideoFile(mockFile);
      setVideoDuration(120);

      const state = useStore.getState();
      expect(state.videoFile?.duration).toBe(120);
      expect(state.timeline.outPoint).toBe(120);
    });
  });

  describe('Timeline management', () => {
    beforeEach(() => {
      const { setVideoFile, setVideoDuration } = useStore.getState();
      const mockFile = {
        file: new File(['test'], 'test.mp4'),
        source: 'file' as const,
        name: 'test.mp4',
        size: 1024,
        type: 'video/mp4',
        url: 'blob:test',
        duration: 100,
      };
      setVideoFile(mockFile);
      setVideoDuration(100);
    });

    describe('In Point', () => {
      it('should set in point within bounds', () => {
        const { setInPoint, setOutPoint } = useStore.getState();
        setOutPoint(100);
        setInPoint(30);
        expect(useStore.getState().timeline.inPoint).toBe(30);
      });

      it('should not allow in point beyond out point', () => {
        const { setInPoint, setOutPoint } = useStore.getState();
        setOutPoint(50);
        setInPoint(60);
        expect(useStore.getState().timeline.inPoint).toBe(50);
      });

      it('should not set in point below 0', () => {
        const { setInPoint } = useStore.getState();
        setInPoint(-10);
        expect(useStore.getState().timeline.inPoint).toBe(0);
      });

      it('should not change in point when locked', () => {
        const { setInPoint, setInPointLocked, setOutPoint } = useStore.getState();
        setOutPoint(100);
        setInPoint(10);
        setInPointLocked(true);
        setInPoint(20);
        expect(useStore.getState().timeline.inPoint).toBe(10);
      });
    });

    describe('Out Point', () => {
      it('should set out point within bounds', () => {
        const { setOutPoint } = useStore.getState();
        setOutPoint(70);
        expect(useStore.getState().timeline.outPoint).toBe(70);
      });

      it('should not allow out point before in point', () => {
        const { setInPoint, setOutPoint } = useStore.getState();
        setOutPoint(100); // First set outPoint to 100
        setInPoint(50);   // Then set inPoint to 50
        setOutPoint(30);  // Try to set outPoint to 30 (should be constrained to 50)
        expect(useStore.getState().timeline.outPoint).toBe(50);
      });

      it('should not allow out point beyond duration', () => {
        const { setOutPoint } = useStore.getState();
        setOutPoint(150);
        expect(useStore.getState().timeline.outPoint).toBe(100);
      });

      it('should not change out point when locked', () => {
        const { setOutPoint, setOutPointLocked } = useStore.getState();
        setOutPoint(80);
        setOutPointLocked(true);
        setOutPoint(90);
        expect(useStore.getState().timeline.outPoint).toBe(80);
      });
    });

    describe('Playhead', () => {
      it('should set playhead within bounds', () => {
        const { setInPoint, setOutPoint, setPlayhead } = useStore.getState();
        setInPoint(20);
        setOutPoint(80);
        setPlayhead(50);
        expect(useStore.getState().timeline.playhead).toBe(50);
      });

      it('should constrain playhead to in point', () => {
        const { setInPoint, setOutPoint, setPlayhead } = useStore.getState();
        setOutPoint(80);  // First set outPoint
        setInPoint(20);   // Then set inPoint
        setPlayhead(10);  // Try to set playhead below inPoint (should be constrained to 20)
        expect(useStore.getState().timeline.playhead).toBe(20);
      });

      it('should constrain playhead to out point', () => {
        const { setInPoint, setOutPoint, setPlayhead } = useStore.getState();
        setInPoint(20);
        setOutPoint(80);
        setPlayhead(90);
        expect(useStore.getState().timeline.playhead).toBe(80);
      });
    });

    describe('Zoom', () => {
      it('should set zoom level', () => {
        const { setZoom } = useStore.getState();
        setZoom(2);
        expect(useStore.getState().timeline.zoom).toBe(2);
      });

      it('should constrain zoom to minimum', () => {
        const { setZoom } = useStore.getState();
        setZoom(0.05);
        expect(useStore.getState().timeline.zoom).toBe(0.1);
      });

      it('should constrain zoom to maximum', () => {
        const { setZoom } = useStore.getState();
        setZoom(15);
        expect(useStore.getState().timeline.zoom).toBe(10);
      });
    });

    describe('Reset timeline', () => {
      it('should reset timeline to initial state', () => {
        const { setInPoint, setOutPoint, setPlayhead, setZoom, resetTimeline } =
          useStore.getState();

        setInPoint(20);
        setOutPoint(80);
        setPlayhead(50);
        setZoom(2);

        resetTimeline();

        const { timeline } = useStore.getState();
        expect(timeline.inPoint).toBe(0);
        expect(timeline.outPoint).toBe(100);
        expect(timeline.playhead).toBe(0);
        expect(timeline.zoom).toBe(1);
        expect(timeline.isInPointLocked).toBe(false);
        expect(timeline.isOutPointLocked).toBe(false);
      });
    });
  });

  describe('Progress management', () => {
    it('should set upload progress', () => {
      const { setUploadProgress } = useStore.getState();
      setUploadProgress(50);
      expect(useStore.getState().processing.uploadProgress).toBe(50);
    });

    it('should set trim progress', () => {
      const { setTrimProgress } = useStore.getState();
      setTrimProgress(30);
      expect(useStore.getState().processing.trimProgress).toBe(30);
    });

    it('should set waveform progress', () => {
      const { setWaveformProgress } = useStore.getState();
      setWaveformProgress(60);
      expect(useStore.getState().processing.waveformProgress).toBe(60);
    });
  });

  describe('Player management', () => {
    it('should toggle playing state', () => {
      const { setIsPlaying } = useStore.getState();
      setIsPlaying(true);
      expect(useStore.getState().player.isPlaying).toBe(true);
      setIsPlaying(false);
      expect(useStore.getState().player.isPlaying).toBe(false);
    });

    it('should set current time', () => {
      const { setCurrentTime } = useStore.getState();
      setCurrentTime(45.5);
      expect(useStore.getState().player.currentTime).toBe(45.5);
    });

    it('should set volume', () => {
      const { setVolume } = useStore.getState();
      setVolume(0.7);
      expect(useStore.getState().player.volume).toBe(0.7);
    });

    it('should constrain volume to 0-1 range', () => {
      const { setVolume } = useStore.getState();
      setVolume(1.5);
      expect(useStore.getState().player.volume).toBe(1);
      setVolume(-0.5);
      expect(useStore.getState().player.volume).toBe(0);
    });

    it('should toggle muted state', () => {
      const { setIsMuted } = useStore.getState();
      setIsMuted(true);
      expect(useStore.getState().player.isMuted).toBe(true);
    });

    it('should set scrubbing state', () => {
      const { setIsScrubbing } = useStore.getState();
      setIsScrubbing(true);
      expect(useStore.getState().player.isScrubbing).toBe(true);
    });
  });

  describe('Error management', () => {
    it('should set error without phase transition', () => {
      const { setError } = useStore.getState();
      setError('Test error', 'TEST_ERROR');

      const { error, phase } = useStore.getState();
      expect(error.hasError).toBe(true);
      expect(error.errorMessage).toBe('Test error');
      expect(error.errorCode).toBe('TEST_ERROR');
      expect(phase).toBe('idle'); // Phase not changed
    });

    it('should set error and transition to error phase', () => {
      const { setErrorAndTransition } = useStore.getState();
      setErrorAndTransition('Test error', 'TEST_ERROR');

      const { error, phase } = useStore.getState();
      expect(error.hasError).toBe(true);
      expect(error.errorMessage).toBe('Test error');
      expect(error.errorCode).toBe('TEST_ERROR');
      expect(phase).toBe('error');
    });

    it('should clear error', () => {
      const { setError, clearError } = useStore.getState();
      setError('Test error');
      clearError();

      const { error } = useStore.getState();
      expect(error.hasError).toBe(false);
      expect(error.errorMessage).toBe(null);
      expect(error.errorCode).toBe(null);
    });
  });

  describe('Export management', () => {
    it('should set export result without phase transition', () => {
      const { setExportResult } = useStore.getState();
      setExportResult('blob:output', 'output.mp4');

      const { export: exportState, phase } = useStore.getState();
      expect(exportState.outputUrl).toBe('blob:output');
      expect(exportState.outputFilename).toBe('output.mp4');
      expect(phase).toBe('idle'); // Phase not changed
    });

    it('should set export result and transition to completed phase', () => {
      const { setExportResultAndComplete } = useStore.getState();
      setExportResultAndComplete('blob:output', 'output.mp4');

      const { export: exportState, phase } = useStore.getState();
      expect(exportState.outputUrl).toBe('blob:output');
      expect(exportState.outputFilename).toBe('output.mp4');
      expect(phase).toBe('completed');
    });

    it('should clear export result', () => {
      const { setExportResult, clearExportResult } = useStore.getState();
      setExportResult('blob:output', 'output.mp4');
      clearExportResult();

      const { export: exportState } = useStore.getState();
      expect(exportState.outputUrl).toBe(null);
      expect(exportState.outputFilename).toBe(null);
    });
  });

  describe('Reset', () => {
    it('should reset entire store', () => {
      const { setPhase, setVideoFile, setInPoint, reset } = useStore.getState();

      setPhase('editing');
      setVideoFile({
        file: new File(['test'], 'test.mp4'),
        source: 'file',
        name: 'test.mp4',
        size: 1024,
        type: 'video/mp4',
        url: 'blob:test',
        duration: 100,
      });
      setInPoint(30);

      reset();

      const state = useStore.getState();
      expect(state.phase).toBe('idle');
      expect(state.videoFile).toBe(null);
      expect(state.timeline.inPoint).toBe(0);
    });
  });
});
