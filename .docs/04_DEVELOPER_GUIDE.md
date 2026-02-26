# Video Trimmer - Developer Guide

> **교육용 학습 자료**: 이 문서는 단순한 프로젝트 소개가 아니라, Video Trimmer 프로젝트를 통해 현대 웹 개발 패턴과 비디오 처리 기술을 배울 수 있는 종합 학습 가이드입니다.

**대상 독자**:
- 웹 개발 경험 1-2년 (React 기본 지식 필요)
- Next.js, TypeScript에 관심 있는 개발자
- 비디오 처리 기술을 배우고 싶은 개발자
- 실제 프로덕션 수준의 코드 패턴을 학습하고 싶은 개발자

**학습 목표**:
- Next.js 16 App Router와 Turbopack 이해
- Zustand 상태 관리 패턴 마스터
- 비디오 처리 기술 (MP4Box, FFmpeg, HLS) 이해
- Feature-based 아키텍처 적용
- 브라우저 메모리 관리 (Object URL, SAB)
- 실시간 진행률 스트리밍 (SSE)

---

## 목차

1. [학습 경로](#학습-경로)
2. [프로젝트 개요](#프로젝트-개요)
3. [아키텍처 심층 분석](#아키텍처-심층-분석)
4. [핵심 개념 설명](#핵심-개념-설명)
5. [개발 워크플로](#개발-워크플로)
6. [주요 패턴과 모범 사례](#주요-패턴과-모범-사례)
7. [디버깅 가이드](#디버깅-가이드)
8. [테스팅 전략](#테스팅-전략)
9. [실전 예제](#실전-예제)
10. [트러블슈팅](#트러블슈팅)

---

## 학습 경로

### Level 1: 기초 이해 (1-2주)

**목표**: 프로젝트 구조와 기본 흐름 파악

**학습 순서**:
1. **환경 설정**
   ```bash
   git clone <repository>
   cd Video_Trimmer
   npm install
   npm run dev
   ```

2. **코드 구조 탐색**
   - `src/app/page.tsx` - 메인 페이지 (시작점)
   - `src/stores/useStore.ts` - 상태 관리 (전역 상태)
   - `src/features/` - 기능별 폴더 구조

3. **기본 워크플로 체험**
   - 파일 업로드 → 편집 → 내보내기 전체 흐름 체험
   - 브라우저 개발자 도구로 네트워크, 콘솔 관찰

4. **문서 읽기**
   - `CLAUDE.md` - 프로젝트 개요
   - `.docs/01_OVERVIEW.md` - 기술 문서
   - `.docs/02_API.md` - API 참조

**확인 과제**:
- [ ] 로컬에서 프로젝트 실행 성공
- [ ] 5개 feature 폴더의 역할 설명 가능
- [ ] Phase-based workflow (5단계) 설명 가능
- [ ] 파일 업로드 → 내보내기 흐름 디버깅 가능

---

### Level 2: 상태 관리 마스터 (2-3주)

**목표**: Zustand 패턴과 React 최적화 이해

**학습 순서**:
1. **Zustand 기초**
   - `src/stores/useStore.ts` 전체 읽기
   - Phase, Timeline, Processing 슬라이스 이해
   - Actions과 Getters 차이 이해

2. **Selector Pattern**
   - `src/stores/selectors.ts` - 재사용 가능한 selectors
   - `src/stores/selectorFactory.ts` - 팩토리 패턴
   - `useShallow`로 리렌더 최적화

3. **Race Condition 제어**
   - `isScrubbing`, `isSeeking` 플래그 역할
   - `timeupdate` 이벤트 핸들러에서 무시 로직
   - `Playhead.tsx` 드래그 로직 분석

**실습 과제**:
```typescript
// 1. 새 selector 추가
export const useExportState = () =>
  useStore(
    useShallow((state) => ({
      phase: state.processing.phase,
      progress: state.processing.progress,
      canExport: state.processing.phase === 'editing',
    }))
  );

// 2. 커스텀 액션 추가
const useStore = create<StoreState>((set, get) => ({
  // ...
  setPlaybackSpeed: (speed: number) => {
    set((state) => ({
      player: { ...state.player, playbackSpeed: speed },
    }));
  },
}));
```

**확인 과제**:
- [ ] 새 selector 만들어보기
- [ ] `useShallow` 있을 때와 없을 때 리렌더 차이 설명
- [ ] Race condition이 발생하는 시나리오 3가지 설명
- [ ] `isScrubbing` 없으면 어떤 버그가 생기는지 설명

---

### Level 3: 비디오 처리 기술 (3-4주)

**목표**: MP4Box, FFmpeg, HLS 트리밍 이해

**학습 순서**:
1. **MP4Box.js 트리밍**
   - `src/features/export/utils/trimVideoMP4Box.ts` 분석
   - MP4 파일 구조 (moov, mdat, samples) 이해
   - 키프레임 기반 트리밍의 원리와 한계

2. **FFmpeg.wasm 트리밍**
   - `src/features/export/utils/trimVideoFFmpeg.ts` 분석
   - SharedArrayBuffer와 멀티스레드 이해
   - 재인코딩 vs 스트림 복사 차이

3. **Dispatcher 패턴**
   - `src/features/export/utils/trimVideoDispatcher.ts` 분석
   - 조건별 자동 선택 로직 (MP4Box → FFmpeg)
   - Fallback 전략

4. **URL 영상 다운로드 (SSE 기반)**
   - `src/lib/downloadJob.ts` - 오케스트레이터 (플랫폼 감지 → 전략 선택)
   - `src/lib/streamlinkDownloader.ts` - Chzzk 2-phase 프로세스
   - `src/lib/ytdlpDownloader.ts` - YouTube 1-phase + `--postprocessor-args`
   - SSE로 실시간 진행률 전송 흐름

**실습 과제**:
```typescript
// 1. MP4Box에서 샘플 필터링 로직 구현
function filterSamples(
  samples: Sample[],
  startTime: number,
  endTime: number
): Sample[] {
  // TODO: 구현
}

// 2. FFmpeg 명령어 생성 로직 이해
const ffmpegArgs = [
  '-i', inputFile,
  '-ss', startTime.toString(),
  '-to', endTime.toString(),
  '-c', 'copy',  // 왜 copy를 사용하는가?
  outputFile,
];
```

**확인 과제**:
- [ ] MP4Box와 FFmpeg의 장단점 5가지씩 설명
- [ ] 키프레임이 무엇이고 왜 1-2초마다 있는지 설명
- [ ] `trimVideoDispatcher`의 조건문 설명
- [ ] Chzzk 2-phase와 YouTube 1-phase의 차이 설명

---

### Level 4: API와 실시간 통신 (2-3주)

**목표**: Next.js API Routes와 SSE 이해

**학습 순서**:
1. **API Routes 구조**
   - `src/app/api/video/resolve/route.ts` - yt-dlp 비디오 정보
   - `src/app/api/video/proxy/route.ts` - CORS 우회 프록시

2. **SSE (Server-Sent Events)**
   - `src/app/api/download/start/route.ts` - Job 시작
   - `src/app/api/download/stream/[jobId]/route.ts` - SSE 스트림
   - `src/app/api/download/[jobId]/route.ts` - 완성 파일 다운로드

3. **Job 관리**
   - `src/lib/downloadJob.ts` - 메모리 내 Job 레지스트리
   - `ReadableStream` 사용법
   - Phase별 진행률 계산

4. **Progress Parsing**
   - `src/lib/progressParser.ts` - Streamlink/FFmpeg stdout 파싱
   - 정규식 패턴 매칭
   - `src/features/url-input/utils/sseProgressUtils.ts` - 클라이언트 가중치 계산

**실습 과제**:
```typescript
// 1. SSE 클라이언트 구현
const eventSource = new EventSource(`/api/download/stream/${jobId}`);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'progress') {
    // TODO: 진행률 UI 업데이트
  } else if (data.type === 'complete') {
    // TODO: 다운로드 시작
  } else if (data.type === 'error') {
    // TODO: 에러 처리
  }
};

// 2. 진행률 가중치 이해
function calculateOverallProgress(phase: string, progress: number): number {
  // downloading: 0-90%, processing: 90-100%
  // TODO: 구현
}
```

**확인 과제**:
- [ ] SSE와 WebSocket 차이 설명
- [ ] EventSource 사용법 설명
- [ ] Chzzk에서만 `processing` phase가 있는 이유 설명
- [ ] 클라이언트 가중치 계산의 필요성 설명

---

### Level 5: 고급 패턴 (3-4주)

**목표**: 실무 수준의 패턴과 최적화 기법

**학습 순서**:
1. **메모리 관리**
   - `URL.createObjectURL()` / `URL.revokeObjectURL()` 패턴
   - Cleanup 레지스트리 (`src/lib/cleanup.ts`)
   - FFmpeg.wasm 인스턴스 관리

2. **Type Safety**
   - Discriminated Union (`src/types/sse.ts`)
   - Type Guards (`src/types/process.ts`, `src/types/browser.ts`)
   - `unknown` vs `any` 사용법

3. **의존성 역전**
   - Store → Features 직접 의존 제거
   - Cleanup 레지스트리 패턴
   - `registerCleanup()` / `runAllCleanups()`

4. **테스트 전략**
   - 단위 테스트 (Vitest)
   - 복잡한 로직만 테스트 (실용적 접근)
   - Mock 객체 사용법

**실습 과제**:
```typescript
// 1. Cleanup 레지스트리 사용
// src/features/export/utils/trimVideoDispatcher.ts
registerCleanup(() => {
  if (ffmpegInstanceRef.current) {
    ffmpegInstanceRef.current.terminate();
    ffmpegInstanceRef.current = null;
  }
});

// 2. Type Guard 작성
export function isSSEProgressEvent(event: SSEEvent): event is SSEProgressEvent {
  return event.type === 'progress';
}

// 3. 메모리 해제
const cleanup = () => {
  if (videoUrl) {
    URL.revokeObjectURL(videoUrl);
  }
};
```

**확인 과제**:
- [ ] Cleanup 레지스트리 패턴의 장점 3가지 설명
- [ ] Discriminated Union이 무엇이고 왜 유용한지 설명
- [ ] Object URL을 revoke하지 않으면 어떻게 되는지 설명
- [ ] 테스트가 필요한 코드와 불필요한 코드 구분

---

## 프로젝트 개요

### 핵심 가치

**1. 개인정보 보호**
- 로컬 파일: 서버 업로드 없음 (브라우저에서만 처리)
- URL 파일: 서버 처리하지만 임시 파일 즉시 삭제

**2. 사용자 경험**
- 10-20배 빠른 트리밍 (MP4Box.js)
- 직관적인 타임라인 UI (드래그 앤 드롭)
- 키보드 단축키 지원 (Space, I/O, 화살표)

**3. 기술적 우수성**
- Feature-based 아키텍처 (확장 가능)
- 자동 의존성 관리 (postinstall)
- 149개 테스트 통과 (안정성)

### 기술 스택

```
Frontend (클라이언트)
├── Next.js 16          # React 프레임워크 (App Router)
├── TypeScript          # 타입 안전성
├── Zustand            # 상태 관리 (단일 스토어)
├── video.js           # 비디오 플레이어
├── wavesurfer.js      # 오디오 파형 시각화
├── MP4Box.js          # 브라우저 MP4 파싱/트리밍
└── FFmpeg.wasm        # 브라우저 비디오 변환 (fallback)

Backend (서버 사이드)
├── Next.js API Routes # REST API
├── yt-dlp             # 비디오 메타데이터 추출 + YouTube 다운로드
├── streamlink         # Chzzk HLS 세그먼트 다운로드
├── ffmpeg             # 타임스탬프 리셋
└── SSE                # 실시간 진행률 스트리밍

Tools & Scripts
├── Vitest             # 단위 테스트
├── Playwright         # E2E 테스트
└── Turbopack          # 빌드 도구 (Next.js 16)
```

### 워크플로

```
┌─────────────────┐
│  1. Upload      │ → Drag & Drop 또는 URL 입력
└─────────────────┘
         ↓
┌─────────────────┐
│  2. Editing     │ → Timeline으로 In/Out 포인트 설정
└─────────────────┘
         ↓
┌─────────────────┐
│  3. Processing  │ → MP4Box (or FFmpeg) 트리밍
└─────────────────┘
         ↓
┌─────────────────┐
│  4. Completed   │ → 다운로드
└─────────────────┘
```

---

## 아키텍처 심층 분석

### 1. Feature-Based 구조

**철학**: 기능별로 완결된 모듈 (components + hooks + utils)

```
src/features/
├── upload/              # 파일 업로드
│   ├── components/
│   │   ├── UploadZone.tsx
│   │   └── FileInfo.tsx
│   ├── hooks/
│   │   └── useFileUpload.ts
│   └── utils/
│       └── validateFile.ts
│
├── url-input/           # URL 입력 및 다운로드
│   ├── components/
│   │   ├── UrlInputZone.tsx
│   │   ├── UrlPreviewCard.tsx
│   │   └── UrlPreviewRangeControl.tsx
│   ├── hooks/
│   │   ├── useUrlInput.ts
│   │   ├── useUrlDownload.ts
│   │   └── useStreamDownload.ts
│   └── utils/
│       └── sseProgressUtils.ts
│
├── player/              # 비디오 플레이어
│   ├── components/
│   │   ├── VideoPlayer.tsx
│   │   └── PlaybackControls.tsx
│   ├── context/
│   │   └── VideoPlayerContext.tsx
│   └── hooks/
│       └── useVideoPlayer.ts
│
├── timeline/            # 타임라인 편집기
│   ├── components/
│   │   ├── TimelineEditor.tsx
│   │   ├── TrimHandle.tsx
│   │   ├── Playhead.tsx
│   │   └── WaveformBackground.tsx
│   ├── hooks/
│   │   ├── usePreviewPlayback.ts
│   │   ├── useTimelineZoom.ts
│   │   └── usePlayheadSeek.ts
│   └── utils/
│       └── constrainPosition.ts
│
└── export/              # 내보내기
    ├── components/
    │   └── ExportButton.tsx
    ├── hooks/
    │   └── useExportState.ts
    └── utils/
        ├── trimVideoDispatcher.ts
        ├── trimVideoMP4Box.ts
        ├── trimVideoFFmpeg.ts
        └── FFmpegSingleton.ts
```

**장점**:
1. **모듈성**: 각 feature는 독립적으로 개발/테스트 가능
2. **확장성**: 새 기능 추가 시 새 폴더만 생성
3. **가독성**: 기능별로 코드가 그룹화되어 찾기 쉬움
4. **재사용성**: hooks와 utils는 feature 내에서 재사용

---

### 2. 상태 관리 (Zustand)

**단일 스토어 패턴**: 하나의 거대한 객체로 모든 상태 관리

```typescript
// src/stores/useStore.ts
export interface StoreState {
  // Phase-based workflow
  processing: {
    phase: AppPhase;
    progress: number;
    videoUrl: string | null;
    processedVideoUrl: string | null;
  };

  // Timeline 상태
  timeline: {
    currentTime: number;
    duration: number;
    inPoint: number;
    outPoint: number;
    zoom: number;
    inLocked: boolean;
    outLocked: boolean;
  };

  // Player 상태
  player: {
    isPlaying: boolean;
    isScrubbing: boolean;
    isSeeking: boolean;
  };

  // Export 상태
  export: {
    trimmedUrl: string | null;
    filename: string;
  };

  // URL Preview (URL 입력 전용)
  urlPreview: VideoFile | null;
  downloadPhase: string | null;
  downloadProgress: number;

  // Actions
  setPhase: (phase: AppPhase) => void;
  setVideoUrl: (url: string, duration: number) => void;
  setInPoint: (time: number) => void;
  setOutPoint: (time: number) => void;
  // ... 30+ actions
}
```

**Selector Pattern**: 최적화된 상태 구독

```typescript
// src/stores/selectors.ts
export const useTimelineState = () =>
  useStore(
    useShallow((state) => ({
      currentTime: state.timeline.currentTime,
      duration: state.timeline.duration,
      inPoint: state.timeline.inPoint,
      outPoint: state.timeline.outPoint,
      zoom: state.timeline.zoom,
    }))
  );

// 사용
function TimelineEditor() {
  const { currentTime, inPoint, outPoint } = useTimelineState();
  // 이 컴포넌트는 timeline 상태 변경 시에만 리렌더
}
```

**왜 useShallow가 필요한가?**

```typescript
// Without useShallow (나쁜 예)
const state = useStore((state) => ({
  currentTime: state.timeline.currentTime,
  inPoint: state.timeline.inPoint,
}));
// 매번 새 객체 생성 → 항상 리렌더

// With useShallow (좋은 예)
const state = useStore(
  useShallow((state) => ({
    currentTime: state.timeline.currentTime,
    inPoint: state.timeline.inPoint,
  }))
);
// 값이 실제로 변경될 때만 리렌더
```

---

### 3. Phase-Based Workflow (FSM)

**유한 상태 기계 (Finite State Machine)** 패턴:

```typescript
export type AppPhase =
  | 'idle'        // 초기 상태 (업로드 대기)
  | 'uploading'   // 파일 로딩 중
  | 'editing'     // 편집 중
  | 'processing'  // 트리밍 처리 중
  | 'completed'   // 완료
  | 'error';      // 에러

// 상태 전이 규칙
idle → uploading → editing → processing → completed
                                        ↘ error
```

**Phase별 UI 렌더링**:

```typescript
// src/app/page.tsx
export default function Home() {
  const phase = useStore((state) => state.processing.phase);

  return (
    <main>
      {phase === 'idle' && <UploadView />}
      {phase === 'uploading' && <LoadingSpinner />}
      {phase === 'editing' && <EditorView />}
      {phase === 'processing' && <ProcessingView />}
      {phase === 'completed' && <CompletedView />}
      {phase === 'error' && <ErrorView />}
    </main>
  );
}
```

---

### 4. Video Player-Timeline 동기화

**핵심 문제**: Race Condition

```
사용자가 Playhead 드래그 중
   ↓
Video Player의 timeupdate 이벤트 발생
   ↓
Store의 currentTime 업데이트
   ↓
Playhead 컴포넌트 리렌더
   ↓
드래그 위치가 덮어써짐 (버그!)
```

**해결책**: `isScrubbing` 플래그

```typescript
// VideoPlayerView.tsx
player.on('timeupdate', () => {
  const state = useStore.getState();

  // CRITICAL: 드래그 중이거나 seeking 중이면 무시
  if (state.player.isScrubbing || player.seeking()) {
    return;
  }

  state.setCurrentTime(currentTime || 0);
});
```

```typescript
// Playhead.tsx
const handleMouseDown = () => {
  setIsScrubbing(true);  // 플래그 켜기
  // ... 드래그 로직
};

const handleMouseUp = () => {
  // ... seek 완료 후
  setIsScrubbing(false);  // 플래그 끄기
};
```

**교훈**: 비동기 이벤트와 사용자 입력이 충돌할 때는 플래그로 제어

---

## 핵심 개념 설명

### 1. MP4Box.js 트리밍 원리

**MP4 파일 구조**:

```
MP4 파일
├── moov (메타데이터)
│   ├── trak (트랙 정보)
│   └── ... (코덱, 길이 등)
└── mdat (실제 데이터)
    ├── Sample 1 (키프레임)
    ├── Sample 2
    ├── Sample 3
    ├── Sample 4 (키프레임)
    └── ...
```

**트리밍 알고리즘**:

```typescript
// 1. MP4 파일 파싱
const mp4boxfile = MP4Box.createFile();
mp4boxfile.appendBuffer(arrayBuffer);
mp4boxfile.flush();

// 2. 샘플 필터링 (시간 범위)
const samples = trak.samples.filter((sample) => {
  const sampleTime = sample.dts / trak.timescale;
  return sampleTime >= startTime && sampleTime < endTime;
});

// 3. 새 MP4 생성
const file = MP4Box.createFile();
const trackId = file.addTrack({
  timescale: trak.timescale,
  // ... 트랙 정보
});

samples.forEach((sample) => {
  file.addSample(trackId, sample.data, {
    duration: sample.duration,
    is_sync: sample.is_sync,  // 키프레임 여부
  });
});

const newArrayBuffer = file.getArrayBuffer();
```

**왜 키프레임 기반인가?**

- **키프레임 (I-Frame)**: 완전한 화면 정보
- **중간 프레임 (P/B-Frame)**: 이전 프레임과의 차이만 저장

**잘못된 자르기**:
```
[I] [P] [P] [P] [I] [P] [P]
        ↑ 여기서 자르면?
```
→ 이전 I-Frame이 없어서 재생 불가!

**올바른 자르기**:
```
[I] [P] [P] [P] [I] [P] [P]
                ↑ 키프레임에서만 자르기
```

**정확도**: ±1-2초 (키프레임 간격)

---

### 2. FFmpeg.wasm 프레임 단위 트리밍

**SharedArrayBuffer 필요성**:

```typescript
// FFmpeg.wasm은 멀티스레드 사용
const ffmpeg = new FFmpeg();
await ffmpeg.load({
  coreURL: '/ffmpeg-core.js',
  wasmURL: '/ffmpeg-core.wasm',
  // SharedArrayBuffer로 메인 스레드와 Worker 간 메모리 공유
});
```

**COEP 헤더 필요**:

```typescript
// next.config.ts
headers: [
  {
    source: '/:path*',
    headers: [
      { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ],
  },
],
```

**트리밍 명령어**:

```typescript
await ffmpeg.exec([
  '-i', 'input.mp4',
  '-ss', startTime.toString(),
  '-to', endTime.toString(),
  '-c:v', 'libx264',      // 비디오 재인코딩
  '-preset', 'ultrafast',  // 빠른 인코딩
  '-c:a', 'aac',          // 오디오 재인코딩
  'output.mp4',
]);
```

**정확도**: ±0.02초 (프레임 단위)

---

### 3. HLS 스트리밍과 Streamlink

**HLS (HTTP Live Streaming)** 구조:

```
마스터 플레이리스트 (master.m3u8)
  ├── 1080p.m3u8
  │   ├── segment-0.ts (10초)
  │   ├── segment-1.ts (10초)
  │   └── segment-2.ts (10초)
  ├── 720p.m3u8
  └── 480p.m3u8
```

**Streamlink 역할**: 플레이리스트 파싱 및 세그먼트 다운로드

```bash
streamlink \
  --hls-start-offset 00:03:05 \   # 시작 시간
  --hls-duration 00:05:00 \        # 길이
  https://chzzk.naver.com/... best -o output.mp4
```

**왜 2단계 프로세스? (Chzzk)**

```
Phase 1: Streamlink
→ temp.mp4 (타임스탬프가 00:03:05부터 시작)

Phase 2: FFmpeg 타임스탬프 리셋
→ output.mp4 (타임스탬프가 00:00:00부터 시작)
```

**필요성**:
- 플레이어는 타임스탬프 00:00:00부터 시작 기대
- 타임스탬프 리셋 없으면 플레이어 오작동 가능

**YouTube는 왜 1-phase?**

```
Phase 1 only: yt-dlp --download-sections --postprocessor-args "ffmpeg:..."
→ final.mp4 (타임스탬프가 00:00:00부터 시작)
```

- yt-dlp가 muxing 과정에서 FFmpeg를 내부적으로 호출
- `--postprocessor-args`로 FFmpeg 옵션 전달 → Phase 2 불필요

---

### 4. Server-Sent Events (SSE)

**SSE vs WebSocket**:

| 특징 | SSE | WebSocket |
|------|-----|-----------|
| 방향 | 서버 → 클라이언트 (단방향) | 양방향 |
| 프로토콜 | HTTP | TCP (Upgrade) |
| 재연결 | 자동 | 수동 |
| 복잡도 | 낮음 | 높음 |
| 사용 사례 | 진행률, 알림 | 채팅, 게임 |

**SSE 서버 구현**:

```typescript
// src/app/api/download/stream/[jobId]/route.ts
export async function GET(request: Request) {
  const jobId = params.jobId;
  const stream = getJobStream(jobId);

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        // SSE 형식으로 인코딩
        const message = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(new TextEncoder().encode(message));
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

**SSE 클라이언트 구현**:

```typescript
// src/features/url-input/hooks/useStreamDownload.ts
const eventSource = new EventSource(`/api/download/stream/${jobId}`);

eventSource.onmessage = (event) => {
  const data: SSEEvent = JSON.parse(event.data);

  switch (data.type) {
    case 'progress':
      const overall = calculateOverallProgress(data.phase, data.progress);
      setDownloadProgress(overall);
      setDownloadPhase(data.phase);
      break;

    case 'complete':
      eventSource.close();  // CRITICAL: 먼저 닫기
      window.location.href = `/api/download/${jobId}`;
      break;

    case 'error':
      eventSource.close();
      setErrorMessage(data.message);
      break;
  }
};
```

**CRITICAL**: EventSource를 먼저 닫아야 함!

```typescript
// 잘못된 순서
window.location.href = '/download';  // 페이지 이동
eventSource.close();  // 실행 안 됨!

// 올바른 순서
eventSource.close();  // 먼저 닫기
window.location.href = '/download';  // 페이지 이동
```

---

## 개발 워크플로

### 1. 로컬 개발 환경 설정

```bash
# 1. 클론
git clone <repository>
cd Video_Trimmer

# 2. 의존성 설치
npm install
# postinstall 훅이 자동으로 바이너리 다운로드

# 3. 개발 서버 실행
npm run dev
# http://localhost:3000

# 4. 타입 체크
npm run type-check

# 5. 테스트
npm test

# 6. 빌드
npm run build
```

### 2. 새 기능 추가 워크플로

**예시**: 비디오 회전 기능 추가

**1단계: Feature 폴더 생성**

```bash
mkdir -p src/features/rotate/{components,hooks,utils}
```

**2단계: 컴포넌트 작성**

```typescript
// src/features/rotate/components/RotateButton.tsx
export function RotateButton() {
  const rotateVideo = useStore((state) => state.rotateVideo);

  return (
    <button onClick={() => rotateVideo(90)}>
      Rotate 90°
    </button>
  );
}
```

**3단계: Store 업데이트**

```typescript
// src/stores/useStore.ts
export interface StoreState {
  rotation: number;  // 0, 90, 180, 270
  rotateVideo: (degrees: number) => void;
}
```

**4단계: 테스트 작성**

```typescript
// src/__tests__/unit/rotate.test.ts
describe('Rotate', () => {
  it('should rotate video by 90 degrees', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.rotateVideo(90);
    });

    expect(result.current.rotation).toBe(90);
  });
});
```

---

## 주요 패턴과 모범 사례

### 1. Cleanup 레지스트리 패턴

**문제**: Store가 Features를 직접 의존

```typescript
// BAD: Store가 trimVideoDispatcher 직접 의존
import { cleanupFFmpeg } from '@/features/export/utils/trimVideoDispatcher';

reset: () => {
  cleanupFFmpeg();  // 직접 호출
  set(initialState);
}
```

**해결**: Cleanup 레지스트리로 의존성 역전

```typescript
// src/lib/cleanup.ts
type CleanupFunction = () => void;
const cleanupRegistry: CleanupFunction[] = [];

export function registerCleanup(fn: CleanupFunction): void {
  if (!cleanupRegistry.includes(fn)) {
    cleanupRegistry.push(fn);
  }
}

export function runAllCleanups(): void {
  cleanupRegistry.forEach((fn) => {
    try {
      fn();
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });
}
```

```typescript
// src/features/export/utils/trimVideoDispatcher.ts
// 모듈 로드 시 자동 등록
registerCleanup(() => FFmpegSingleton.cleanup());
```

```typescript
// src/stores/useStore.ts
import { runAllCleanups } from '@/lib/cleanup';

reset: () => {
  runAllCleanups();  // 레지스트리만 의존
  set(initialState);
}
```

**장점**:
1. Store가 Features를 직접 의존하지 않음
2. 새 cleanup 추가 시 Store 수정 불필요
3. 테스트 시 cleanup 모킹 쉬움

---

### 2. Type Guards 패턴

**문제**: `any` 타입 남용

```typescript
// BAD
function handleError(error: any) {
  console.error(error.message);  // error가 Error인지 모름
}
```

**해결**: Type Guards로 타입 안전성

```typescript
// src/types/process.ts
export interface ProcessError extends Error {
  code?: string;
  killed?: boolean;
  stderr?: string;
  exitCode?: number;
}

export function isProcessError(error: unknown): error is ProcessError {
  return error instanceof Error;
}

export function toProcessError(error: unknown): ProcessError {
  if (isProcessError(error)) return error;

  const err = new Error(String(error)) as ProcessError;
  if (typeof error === 'object' && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.code === 'string') err.code = obj.code;
    if (typeof obj.killed === 'boolean') err.killed = obj.killed;
    if (typeof obj.stderr === 'string') err.stderr = obj.stderr;
  }
  return err;
}
```

---

### 3. Discriminated Union 패턴

**문제**: 타입 좁히기 어려움

```typescript
// BAD
interface SSEEvent {
  type: string;
  progress?: number;
  filename?: string;
  message?: string;
}
```

**해결**: Discriminated Union

```typescript
// src/types/sse.ts
export interface SSEProgressEvent {
  type: 'progress';
  progress: number;
  processedSeconds: number;
  totalSeconds: number;
  phase: 'downloading' | 'processing' | 'completed';
}

export interface SSECompleteEvent {
  type: 'complete';
  filename: string;
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

export type SSEEvent =
  | SSEProgressEvent
  | SSECompleteEvent
  | SSEErrorEvent;
```

```typescript
// 사용
function handleEvent(event: SSEEvent) {
  switch (event.type) {
    case 'progress':
      console.log(event.progress);  // 타입 안전!
      console.log(event.phase);
      break;

    case 'complete':
      console.log(event.filename);  // 타입 안전!
      break;

    case 'error':
      console.error(event.message);  // 타입 안전!
      break;
  }
}
```

---

## 디버깅 가이드

### 1. Playhead Snap-Back 버그

**증상**: 드래그 중 playhead가 원래 위치로 돌아갔다가 다시 옴

**원인**: Race Condition

```
1. 사용자가 playhead 드래그 시작
2. Video player의 timeupdate 이벤트 발생
3. Store의 currentTime 업데이트
4. Playhead 리렌더 → 드래그 위치 덮어써짐
```

**디버깅**:

```typescript
// 1. 콘솔 로그 추가
player.on('timeupdate', () => {
  console.log('[timeupdate] isScrubbing:', state.player.isScrubbing);
  console.log('[timeupdate] seeking:', player.seeking());

  if (state.player.isScrubbing || player.seeking()) {
    console.log('[timeupdate] IGNORED');
    return;
  }

  console.log('[timeupdate] UPDATE currentTime:', currentTime);
  state.setCurrentTime(currentTime || 0);
});
```

**해결**:

```typescript
// Playhead.tsx
const handleMouseDown = () => {
  console.log('[Playhead] mousedown - set isScrubbing=true');
  setIsScrubbing(true);
};

const handleMouseUp = () => {
  console.log('[Playhead] mouseup - set isScrubbing=false');
  setIsScrubbing(false);
};
```

---

### 2. Memory Leak (Object URL)

**증상**: 메모리 사용량이 계속 증가

**원인**: Object URL을 revoke하지 않음

**디버깅**:

```typescript
// Chrome DevTools → Memory → Heap Snapshot
// Detached HTMLMediaElement 검색
```

**해결**:

```typescript
// GOOD
const cleanup = () => {
  if (videoUrl) {
    console.log('[cleanup] Revoking Object URL:', videoUrl);
    URL.revokeObjectURL(videoUrl);
  }
};

// Store reset 시
reset: () => {
  const { videoUrl, processedVideoUrl, trimmedUrl } = get();

  if (videoUrl) URL.revokeObjectURL(videoUrl);
  if (processedVideoUrl) URL.revokeObjectURL(processedVideoUrl);
  if (trimmedUrl) URL.revokeObjectURL(trimmedUrl);

  set(initialState);
}
```

---

### 3. SSE Connection Error

**증상**: EventSource onerror 계속 발생

**원인**: 서버가 먼저 연결을 닫음 (정상 완료)

**해결**:

```typescript
// GOOD
eventSource.onmessage = (event) => {
  if (data.type === 'complete') {
    eventSource.close();  // 먼저 닫기
    eventSourceRef.current = null;
    window.location.href = '/download';
  }
};

eventSource.onerror = (error) => {
  if (eventSourceRef.current) {  // 아직 열려있으면 에러
    console.error('Connection error:', error);
  }
  // null이면 정상 완료 후 닫힌 것 (무시)
};
```

---

## 테스팅 전략

### 실용적 테스트 철학

**원칙**: 복잡한 로직, 고위험 코드, 모니터링이 필요한 핵심 동작만 테스트

**테스트가 필요한 코드**:
1. ✅ 비즈니스 로직 (trimming, progress calculation)
2. ✅ 상태 관리 (Store actions)
3. ✅ 바이너리 의존성 검증
4. ✅ 복잡한 계산 (시간 변환, 제약 조건)

**테스트가 불필요한 코드**:
1. ❌ 간단한 유틸리티 (이미 검증됨)
2. ❌ 상수 객체 (타입스크립트로 충분)
3. ❌ UI 컴포넌트 (E2E 테스트로 대체)

### 테스트 예시

**1. Store 테스트 (필수)**

```typescript
// src/__tests__/unit/useStore.test.ts
describe('Store - Timeline', () => {
  it('should set in point within valid range', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.setVideoUrl('test.mp4', 100);
      result.current.setInPoint(30);
    });

    expect(result.current.timeline.inPoint).toBe(30);
  });
});
```

**2. 바이너리 검증 테스트 (필수)**

```typescript
// src/__tests__/unit/binPaths.test.ts
describe('Binary Dependencies', () => {
  it('should have ffmpeg available', () => {
    const ffmpegPath = getFfmpegPath();
    expect(ffmpegPath).toBeTruthy();
    expect(existsSync(ffmpegPath)).toBe(true);
  });
});
```

**3. 복잡한 계산 테스트 (필수)**

```typescript
// src/__tests__/unit/sseProgressUtils.test.ts
describe('SSE Progress Utils', () => {
  it('should calculate overall progress with phase weights', () => {
    // downloading: 0-90%
    expect(calculateOverallProgress('downloading', 0)).toBe(0);
    expect(calculateOverallProgress('downloading', 50)).toBe(45);
    expect(calculateOverallProgress('downloading', 100)).toBe(90);

    // processing: 90-100%
    expect(calculateOverallProgress('processing', 0)).toBe(90);
    expect(calculateOverallProgress('processing', 50)).toBe(95);
    expect(calculateOverallProgress('processing', 100)).toBe(100);
  });
});
```

---

## 실전 예제

### 예제 1: 새 Preview 모드 추가

**요구사항**: "Preview Last 10s" 버튼 추가

**1단계: UI 컴포넌트**

```typescript
// src/features/timeline/components/PreviewButtons.tsx
export function PreviewButtons() {
  const { previewLast10s } = usePreviewPlayback();

  return (
    <div>
      <button onClick={previewLast10s}>
        Preview Last 10s
      </button>
    </div>
  );
}
```

**2단계: Hook 로직**

```typescript
// src/features/timeline/hooks/usePreviewPlayback.ts
export function usePreviewPlayback() {
  const { play, seek } = useVideoPlayerContext();
  const outPoint = useStore((state) => state.timeline.outPoint);

  const previewLast10s = useCallback(() => {
    const startTime = Math.max(0, outPoint - 10);
    seek(startTime);
    play();
  }, [outPoint, seek, play]);

  return { previewLast10s };
}
```

---

### 예제 2: 새 Export 형식 추가

**요구사항**: WebM 형식 내보내기 지원

**1단계: FFmpeg 명령어**

```typescript
// src/features/export/utils/trimVideoFFmpeg.ts
async function trimToWebM(
  inputFile: string,
  startTime: number,
  endTime: number
): Promise<Uint8Array> {
  await ffmpeg.exec([
    '-i', inputFile,
    '-ss', startTime.toString(),
    '-to', endTime.toString(),
    '-c:v', 'libvpx-vp9',    // WebM 비디오 코덱
    '-c:a', 'libopus',       // WebM 오디오 코덱
    'output.webm',
  ]);

  const data = await ffmpeg.readFile('output.webm');
  return data as Uint8Array;
}
```

**2단계: Dispatcher 업데이트**

```typescript
// src/features/export/utils/trimVideoDispatcher.ts
export async function trimVideo(): Promise<string> {
  const { format } = useStore.getState().export;

  if (format === 'webm') {
    return await trimToWebM(file, startTime, endTime);
  } else {
    return await trimToMP4(file, startTime, endTime);
  }
}
```

---

## 트러블슈팅

### 문제 1: FFmpeg 빌드 실패

**증상**:
```
Error: Cannot find module '@ffmpeg-installer/ffmpeg'
```

**원인**: `serverExternalPackages` 설정 누락

**해결**:
```typescript
// next.config.ts
serverExternalPackages: ['@ffmpeg-installer/ffmpeg', 'yt-dlp-wrap'],
```

---

### 문제 2: SharedArrayBuffer 사용 불가

**증상**:
```
ReferenceError: SharedArrayBuffer is not defined
```

**원인**: COEP 헤더 없음

**해결**:
```typescript
// next.config.ts
headers: [
  {
    source: '/:path*',
    headers: [
      { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    ],
  },
],
```

---

### 문제 3: Streamlink 다운로드 실패

**증상**:
```
streamlink: not found
```

**해결**: `.docs/03_DEPENDENCIES.md` 참조

---

## 추가 학습 자료

### 공식 문서

- [Next.js 16 문서](https://nextjs.org/docs)
- [Zustand 문서](https://zustand-demo.pmnd.rs/)
- [video.js 가이드](https://videojs.com/guides/)
- [MP4Box.js GitHub](https://github.com/gpac/mp4box.js)
- [FFmpeg.wasm 문서](https://ffmpegwasm.netlify.app/)

### 프로젝트 문서

- `CLAUDE.md` - 프로젝트 개요 및 커밋 가이드 (Quick Reference)
- `.docs/01_OVERVIEW.md` - 기술 문서
- `.docs/02_API.md` - API 참조
- `.docs/03_DEPENDENCIES.md` - 바이너리/의존성 문서
- `.docs/05_HISTORY.md` - 개발 히스토리

### 학습 순서 추천

1. **Week 1-2**: Level 1 (기초 이해)
2. **Week 3-4**: Level 2 (상태 관리)
3. **Week 5-7**: Level 3 (비디오 처리)
4. **Week 8-9**: Level 4 (API와 SSE)
5. **Week 10-12**: Level 5 (고급 패턴)

### 실습 프로젝트

1. **새 Preview 모드** (난이도: ★☆☆☆☆)
   - "Preview Middle 5s" 버튼 추가

2. **Playback Speed** (난이도: ★★☆☆☆)
   - 재생 속도 조절 (0.5x, 1x, 1.5x, 2x)

3. **Export 형식 선택** (난이도: ★★★☆☆)
   - MP4, WebM, AVI 선택 가능

4. **Undo/Redo** (난이도: ★★★★☆)
   - In/Out Point 변경 히스토리 관리

5. **멀티트랙 타임라인** (난이도: ★★★★★)
   - 여러 비디오 클립을 하나의 타임라인에 배치

---

## 마치며

이 문서는 Video Trimmer 프로젝트를 통해 현대 웹 개발의 핵심 패턴을 학습할 수 있도록 작성되었습니다. 단순히 코드를 읽는 것을 넘어, **왜 이렇게 설계되었는지**, **어떤 문제를 해결하는지**를 이해하는 것이 중요합니다.

**핵심 교훈**:
1. **Phase-based workflow**로 복잡한 상태 관리 단순화
2. **Feature-based 아키텍처**로 확장 가능한 코드베이스
3. **Race condition 제어**로 안정적인 비동기 처리
4. **메모리 관리**로 브라우저 성능 최적화
5. **실용적 테스트**로 핵심 로직 검증

**질문이나 개선 사항**이 있다면 GitHub Issues로 제출해주세요.

**Happy Coding!**
