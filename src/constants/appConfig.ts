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
    /** Seek 확인 타임아웃 (ms) */
    SEEK_VERIFICATION_TIMEOUT_MS: 1000,
    /** Seek fallback 타임아웃 (ms) */
    SEEK_FALLBACK_TIMEOUT_MS: 500,
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

  /**
   * 내보내기 관련 설정
   */
  EXPORT: {
    /** 기본 비트레이트 (kbps) */
    DEFAULT_BITRATE_KBPS: 2500,
  },

  /**
   * 진행률 계산 관련 설정
   */
  PROGRESS: {
    /** Segment 최소 다운로드 시간 (초) */
    SEGMENT_MIN_TIME_SEC: 0.5,
    /** Segment 최대 다운로드 시간 (초) */
    SEGMENT_MAX_TIME_SEC: 30,
  },

  /**
   * 시간 변환 관련 설정
   */
  TIME: {
    /** 1분 = 60초 */
    SECONDS_PER_MINUTE: 60,
    /** 1시간 = 3600초 */
    SECONDS_PER_HOUR: 3600,
    /** 1초 = 1000밀리초 */
    MILLISECONDS_PER_SECOND: 1000,
  },

  /**
   * UI 타이밍 관련 설정
   */
  UI: {
    /** Waveform 초기화 지연 시간 (ms) */
    WAVEFORM_INIT_DELAY_MS: 100,
    /** Waveform 줌 debounce 지연 시간 (ms) */
    WAVEFORM_ZOOM_DEBOUNCE_MS: 100,
    /** 타임라인 줌 스텝 */
    TIMELINE_ZOOM_STEP: 0.1,
  },

  /**
   * 미리보기 재생 관련 설정
   */
  PLAYBACK: {
    /** 긴 세그먼트 기준 (초) - 이 값 이상이면 Preview Edges 적용 */
    PREVIEW_LONG_SEGMENT_THRESHOLD_SEC: 10,
    /** Preview Edges 재생 길이 (초) */
    PREVIEW_EDGE_DURATION_SEC: 5,
  },

  /**
   * 폴링 간격 관련 설정
   */
  POLLING: {
    /** 다운로드 진행률 체크 간격 (ms) */
    PROGRESS_CHECK_INTERVAL_MS: 200,
  },
} as const;

// 타입 안전성을 위한 개별 export
export const { TIMELINE, URL_INPUT, PROCESS, EXPORT, PROGRESS, TIME, UI, PLAYBACK, POLLING } =
  APP_CONFIG;
