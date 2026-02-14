// 원초 상수 (키보드 코드)
export const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: ' ', // Space
  FRAME_BACKWARD: 'ArrowLeft',
  FRAME_FORWARD: 'ArrowRight',
  SECOND_BACKWARD: 'Shift+ArrowLeft',
  SECOND_FORWARD: 'Shift+ArrowRight',
  SET_IN_POINT: 'i',
  SET_OUT_POINT: 'o',
  GOTO_IN_POINT: 'Home',
  GOTO_OUT_POINT: 'End',
  PREVIEW: 'a',
} as const;

// 파생 상수 (라벨 매핑)
// Note: 원초성(primitivity) 확보를 위해 함수로 분리
export function getShortcutLabels() {
  return {
    [KEYBOARD_SHORTCUTS.PLAY_PAUSE]: 'Space',
    [KEYBOARD_SHORTCUTS.FRAME_BACKWARD]: '←',
    [KEYBOARD_SHORTCUTS.FRAME_FORWARD]: '→',
    [KEYBOARD_SHORTCUTS.SECOND_BACKWARD]: 'Shift + ←',
    [KEYBOARD_SHORTCUTS.SECOND_FORWARD]: 'Shift + →',
    [KEYBOARD_SHORTCUTS.SET_IN_POINT]: 'I',
    [KEYBOARD_SHORTCUTS.SET_OUT_POINT]: 'O',
    [KEYBOARD_SHORTCUTS.GOTO_IN_POINT]: 'Home',
    [KEYBOARD_SHORTCUTS.GOTO_OUT_POINT]: 'End',
    [KEYBOARD_SHORTCUTS.PREVIEW]: 'A',
  } as const;
}

// 하위 호환성을 위한 즉시 실행
export const KEYBOARD_SHORTCUT_LABELS = getShortcutLabels();

// 타임라인 탐색 상수
export const FRAME_STEP = 1 / 30; // 30fps 기준 1프레임
export const SECOND_STEP = 1; // 1초
