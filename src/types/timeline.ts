export type HandleType = 'inPoint' | 'outPoint' | 'playhead';

export interface TimelinePosition {
  x: number;        // 픽셀 단위
  time: number;     // 초 단위
}

export interface DragState {
  isDragging: boolean;
  handleType: HandleType | null;
  startX: number;
  startTime: number;
}
