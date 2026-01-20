import { useEffect, useCallback } from 'react';
import { useStore } from '@/stores/useStore';

export interface KeyboardShortcutsConfig {
  onPlayPause?: () => void;
  onFrameForward?: () => void;
  onFrameBackward?: () => void;
  onSecondForward?: () => void;
  onSecondBackward?: () => void;
  onSetInPoint?: () => void;
  onSetOutPoint?: () => void;
  onJumpToInPoint?: () => void;
  onJumpToOutPoint?: () => void;
  onPreviewMode?: () => void;
}

export function useKeyboardShortcuts(config: KeyboardShortcutsConfig) {
  const phase = useStore((state) => state.phase);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // editing 또는 ready 상태에서만 작동
      if (phase !== 'editing' && phase !== 'ready') {
        return;
      }

      // 입력 요소에 포커스가 있으면 무시
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const { key, shiftKey } = event;

      switch (key) {
        case ' ': // Space
          event.preventDefault();
          config.onPlayPause?.();
          break;

        case 'ArrowLeft':
          event.preventDefault();
          if (shiftKey) {
            config.onSecondBackward?.();
          } else {
            config.onFrameBackward?.();
          }
          break;

        case 'ArrowRight':
          event.preventDefault();
          if (shiftKey) {
            config.onSecondForward?.();
          } else {
            config.onFrameForward?.();
          }
          break;

        case 'i':
        case 'I':
          event.preventDefault();
          config.onSetInPoint?.();
          break;

        case 'o':
        case 'O':
          event.preventDefault();
          config.onSetOutPoint?.();
          break;

        case 'Home':
          event.preventDefault();
          config.onJumpToInPoint?.();
          break;

        case 'End':
          event.preventDefault();
          config.onJumpToOutPoint?.();
          break;

        case 'a':
        case 'A':
          event.preventDefault();
          config.onPreviewMode?.();
          break;

        default:
          break;
      }
    },
    [phase, config]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
