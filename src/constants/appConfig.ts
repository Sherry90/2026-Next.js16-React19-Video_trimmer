/**
 * 애플리케이션 전역 설정 상수
 *
 * 각 섹션별로 관련 설정을 그룹화하여 관리
 */
export const APP_CONFIG = {
  /**
   * 타임라인 관련 설정
   */
  TIMELINE: {
    /** 최대 세그먼트 길이 (초) - 10분 */
    MAX_SEGMENT_DURATION_SECONDS: 600,
    /** 최소 줌 배율 */
    MIN_ZOOM: 0.1,
    /** 최대 줌 배율 */
    MAX_ZOOM: 10,
    /** Playhead 이동 throttle 지연 시간 (ms) */
    PLAYHEAD_SEEK_THROTTLE_MS: 50,
  },

  /**
   * URL 입력 관련 설정
   */
  URL_INPUT: {
    /** 입력 debounce 지연 시간 (ms) */
    DEBOUNCE_MS: 100,
  },

  /**
   * 프로세스 타임아웃 설정
   */
  PROCESS: {
    /** Streamlink 프로세스 타임아웃 (ms) - 5분 */
    STREAMLINK_TIMEOUT_MS: 300000,
    /** FFmpeg 프로세스 타임아웃 (ms) - 1분 */
    FFMPEG_TIMEOUT_MS: 60000,
  },
} as const;

// 타입 안전성을 위한 개별 export
export const { TIMELINE, URL_INPUT, PROCESS } = APP_CONFIG;
