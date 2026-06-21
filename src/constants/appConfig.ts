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
    /** 최소 줌 배율 */
    MIN_ZOOM: 0.1,
    /** 최대 줌 배율 */
    MAX_ZOOM: 10,
    /** content track 최대 폭(px) — 캔버스/파형 폭 폭주 방지 */
    MAX_CONTENT_PX: 32000,
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
    /** yt-dlp 프로세스 타임아웃 (ms) - 5분 (streamlink와 동일) */
    YTDLP_TIMEOUT_MS: 300000,
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
    /** 1분의 최대 초 = 59 */
    MAX_SECONDS_PER_MINUTE: 59,
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
    /** 플레이어 기본 볼륨 (0~1). 스토어 초기값 + player.volume() 적용 + UI readback 단일 출처. */
    DEFAULT_VOLUME: 0.5,
    /** 긴 세그먼트 기준 (초) - 이 값 이상이면 Preview Edges 적용 */
    PREVIEW_LONG_SEGMENT_THRESHOLD_SEC: 10,
    /** Preview Edges 재생 길이 (초) */
    PREVIEW_EDGE_DURATION_SEC: 5,
    /**
     * 스트리밍 소스 seek 후 버퍼 준비 대기 상한 (ms).
     * canplay/playing이 이 시간 내 안 오면 강제로 play 시도하고 isScrubbing 해제
     * (stuck isScrubbing이 일반 timeupdate를 영구 차단하는 것 방지).
     */
    PREVIEW_BUFFER_TIMEOUT_MS: 5000,
  },

  /**
   * 폴링 간격 관련 설정
   */
  POLLING: {
    /** 다운로드 진행률 체크 간격 (ms) */
    PROGRESS_CHECK_INTERVAL_MS: 200,
  },

  /**
   * 다운로드 관련 설정
   */
  DOWNLOAD: {
    /** Streamlink HLS 세그먼트 스레드 수 */
    STREAMLINK_SEGMENT_THREADS: 6,
    /** yt-dlp 동시 다운로드 fragment 수 */
    YTDLP_CONCURRENT_FRAGMENTS: 8,
    /** aria2c 최대 연결 수 */
    ARIA2C_MAX_CONNECTIONS: 16,
    /** aria2c 분할 수 */
    ARIA2C_SPLIT_COUNT: 16,
    /** aria2c 청크 크기 */
    ARIA2C_CHUNK_SIZE: '1M',
    /** 유효 파일 최소 크기 (bytes) - MP4 헤더(4-8KB) + 실제 데이터 여유 */
    MIN_VALID_FILE_SIZE: 32 * 1024,
    /** 고아 잡 정리 유예 시간 (ms) - 재연결 허용 시간 */
    JOB_ORPHAN_GRACE_PERIOD_MS: 30_000,
    /** 완료/실패 잡 TTL (ms) - 30분 후 자동 정리 */
    JOB_TTL_MS: 30 * 60 * 1000,
    /**
     * 정체(stall) 타임아웃 (ms). 다운로드는 사용자 디스크로 직행 스트리밍이라 용량/시간 상한이
     * 무의미하다 — 길고 느린 다운로드도 정상이다. 그래서 절대 시간 제한 대신, **진행이 완전히
     * 멈춘 경우에만** 죽인다(죽은 소켓에 매달린 yt-dlp/ffmpeg, 무한 재시도 등).
     * 이 시간 동안 한 바이트의 진행도 없으면 hang으로 보고 중단한다.
     * yt-dlp 초기 메타데이터/연결 셋업의 조용한 구간(수~수십초)을 넘기도록 넉넉히 잡음.
     */
    STALL_TIMEOUT_MS: 120_000,
    /** stall 감시 폴링 간격 (ms) */
    STALL_CHECK_INTERVAL_MS: 10_000,
    /**
     * 잡 전체 wall 안전 타임아웃 (ms) - 런어웨이 백스톱.
     * stall 감시(무출력)로 안 잡히는 병적 케이스(출력은 내뱉으며 무한 재시도/스핀 등)에서
     * 잡을 강제 abort해 자식 프로세스 트리까지 정리한다. 정상 다운로드보다 충분히 길게(20분).
     * 절대 한계가 아니라 "죽지 않게 하는" 백스톱 — 서버가 죽느니 잡을 실패시킨다.
     */
    MAX_JOB_MS: 20 * 60 * 1000,
    /** byte-range 단일 Range fetch 타임아웃 (ms) - 응답 없는 소켓에 매달리지 않게. */
    RANGE_FETCH_TIMEOUT_MS: 60_000,
    /**
     * byte-range 허용 최대 media 바이트(video+audio 합). 이보다 크면(=긴 영상/큰 클립) byte-range는
     * 전체를 메모리(arrayBuffer)에 적재해 비효율·OOM 위험 → fetch 전에 폴백(aria2c→디스크)로 전환.
     * byte-range는 "긴 영상의 짧은 클립"에만 이득이므로 작은 범위로 제한.
     */
    MAX_BYTERANGE_BYTES: 64 * 1024 * 1024,
  },

  /**
   * 파형(waveform) 추출 관련 설정
   */
  WAVEFORM: {
    /**
     * 파형 추출 최대 길이 (초). 이 값을 넘는 소스는 파형을 생략한다.
     * 긴 VOD(수시간)는 전체 오디오 추출이 메모리/시간 한도를 초과해 실패하고,
     * 1000px 타임라인에 수시간 파형은 버킷당 십수 초라 시각적으로도 무의미하다.
     */
    MAX_DURATION_SEC: 60 * 60, // 1시간
    /**
     * 초당 목표 peak 수 (길이 비례 해상도). 최대줌(zoom*10 → 100px/s, 막대 피치 3px)
     * 천장이 ~33막대/초라 40이면 여유 있게 포화한다. 그 이상은 페이로드 낭비.
     */
    PEAKS_PER_SEC: 40,
    /**
     * peak 총량 상한 (페이로드/메모리 보호).
     * ~60분 소스가 14만개를 뱉어 응답이 수 MB가 되는 것을 막는다.
     */
    MAX_PEAKS: 32000,
  },

  /**
   * 타임라인 시각 설정 (파형 + 스펙트럴 오버레이).
   * 파형과 스펙트럴을 항상 겹쳐 표시하므로 색/투명도/블렌드를 한곳에서 조절한다.
   */
  WAVEFORM_VIEW: {
    /** 파형 막대 색 — 스펙트럴 위에 겹치므로 대비 높은 색(흰색 권장). */
    WAVE_COLOR: '#ffffff',
    /** 파형 오버레이 투명도 (0~1). 스펙트럴이 비치도록 반투명. */
    WAVE_OPACITY: 0.25,
    /** 파형 블렌드 모드. 'screen'은 어두운 스펙트럴 위에 막대만 떠보이게 한다. */
    WAVE_BLEND_MODE: 'screen' as const,
    /** 줌 > 4 일 때 막대 폭(px). */
    BAR_WIDTH_ZOOMED: 1,
    /** 기본 막대 폭(px). */
    BAR_WIDTH_DEFAULT: 1,
    /** 막대 간격(px). */
    BAR_GAP: 1,

    /** 스펙트럴 로컬 분석(파일 소스) 리샘플 레이트(Hz). */
    SPECTRAL_SAMPLE_RATE: 8000,
    /** FFT 크기(샘플). 주파수 해상도 ↔ 시간 해상도 트레이드오프. */
    SPECTRAL_FFT_SIZE: 256,
    /** 프레임 간 hop 크기(샘플). 작을수록 시간축 촘촘(프레임 수 ∝ 1/hop). */
    SPECTRAL_HOP_SIZE: 256,
    /**
     * 주파수 막대(bin) 수. 스펙트럴 세로 해상도.
     * FFT_SIZE/2(=mag bin 수) 이하여야 의미 있음(현재 256/2=128).
     */
    SPECTRAL_FREQ_BINS: 128,
    /** 프레임 상한. 초과 시 stride 로 솎아 페이로드/연산 보호. */
    SPECTRAL_MAX_FRAMES: 2400,
    /** 스펙트럴 캔버스 배경 채움색(데이터 없는 영역). */
    SPECTRAL_BG: '#101114',
    /**
     * 스펙트럴 intensity 로그 스케일 계수. log10(1 + mag * SCALE) 로 압축.
     * 키우면 약한 신호가 더 밝게(대비↓), 줄이면 강한 피크만 부각(대비↑).
     */
    SPECTRAL_LOG_SCALE: 80,
    /** 스펙트럴 색 매핑(HSL). intensity 0~1에 따라 hue/sat/light 보간. */
    HUE_BASE: 226,
    HUE_RANGE: 178,
    SAT_BASE: 50,
    SAT_RANGE: 45,
    LIGHT_BASE: 10,
    LIGHT_RANGE: 54,

    /** 스펙트럴 그리드 가로선 색. */
    GRID_STROKE: 'rgba(255, 255, 255, 0.12)',
    /** 스펙트럴 그리드 분할 수(가로선은 분할-1개). */
    GRID_DIVISIONS: 4,
  },
} as const;

// 타입 안전성을 위한 개별 export
export const {
  TIMELINE,
  URL_INPUT,
  PROCESS,
  EXPORT,
  PROGRESS,
  TIME,
  UI,
  PLAYBACK,
  POLLING,
  DOWNLOAD,
  WAVEFORM,
  WAVEFORM_VIEW,
} = APP_CONFIG;
