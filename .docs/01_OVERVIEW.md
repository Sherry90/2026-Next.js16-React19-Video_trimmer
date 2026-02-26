# Video Trimmer - 프로젝트 개요

> **문서 버전**: 2.2
> **최종 업데이트**: 2026-02-25

---

## 목차

1. [기술 개념 (Technical Concepts)](#기술-개념-technical-concepts)
2. [개요](#개요)
3. [기술 스택](#기술-스택)
4. [아키텍처](#아키텍처)
5. [개발 워크플로](#개발-워크플로)
6. [성능 특성](#성능-특성)
7. [제약사항 및 한계](#제약사항-및-한계)
8. [문서 구조](#문서-구조)

---

## 기술 개념 (Technical Concepts)

> 💡 **선택적 읽기**: 이 섹션은 문서 전체를 이해하는 데 필요한 기술 용어를 정의합니다. 이미 익숙한 개념은 건너뛰셔도 됩니다.

### 비디오 처리

| 기술 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **MP4Box.js** | 재인코딩 없는 MP4 트리밍 | 10-20배 빠름, 품질 유지 | ±1-2초 정확도 (키프레임) |
| **FFmpeg** | 비디오/오디오 변환 도구 | ±0.02초 정확도 | 느림, 재인코딩 필요 |
| **HLS** | 적응형 스트리밍 프로토콜 | 세그먼트 기반 다운로드 | ±1초 정확도 (세그먼트) |
| **Stream Copy** | 재인코딩 없이 재패키징 | 품질 손실 없음, 빠름 | 키프레임 의존 |
| **Keyframe** | 다른 프레임이 참조하는 기준 | 트리밍 스냅 지점 | 1-2초마다 위치 |

### 상태 관리 & 브라우저 API

| 기술/패턴 | 설명 | 프로젝트 사용 |
|-----------|------|---------------|
| **Zustand** | 최소주의 상태 관리 | 단일 스토어 (`useStore.ts`) |
| **Race Condition** | 경쟁적 상태 업데이트 | `isScrubbing` 플래그로 제어 |
| **Selector Pattern** | 특정 슬라이스만 구독 | `useShallow` 최적화 |
| **COEP** | Cross-origin 격리 정책 | `credentialless` (SAB 허용) |
| **SharedArrayBuffer** | Worker 간 메모리 공유 | FFmpeg.wasm 멀티스레드 |
| **Object URL** | Blob → URL 변환 | `revokeObjectURL` 메모리 관리 |

### 아키텍처 패턴

| 패턴 | 설명 | 예시 |
|------|------|------|
| **Dispatcher** | 조건별 구현체 자동 선택 | MP4Box vs FFmpeg |
| **Feature-based** | 기능별 폴더 구성 | `timeline/` (components, hooks, utils) |
| **Phase-based Workflow** | FSM 패턴 상태 관리 | idle → uploading → editing → processing → completed |
| **Strategy Pattern** | 런타임 알고리즘 선택 | Chzzk → Streamlink, YouTube → yt-dlp |

### 용어 대조표

| 한국어 | 영어 | 설명 |
|--------|------|------|
| 트리밍 | Trimming | 비디오 구간 잘라내기 |
| 인 포인트 | In Point | 트리밍 시작 지점 |
| 아웃 포인트 | Out Point | 트리밍 종료 지점 |
| 플레이헤드 | Playhead | 현재 재생 위치 표시 |
| 타임라인 | Timeline | 비디오 전체 시각화 바 |
| 핸들 | Handle | In/Out Point 드래그 UI |
| 스크러빙 | Scrubbing | 플레이헤드 드래그 탐색 |
| 시킹 | Seeking | 특정 시간으로 점프 |

---

## 개요

**Video Trimmer**는 서버 업로드 없이 브라우저에서 완전히 동영상을 트리밍할 수 있는 클라이언트 사이드 웹 애플리케이션입니다.

### 핵심 기능

**입력 방식**:
- ✅ **로컬 파일**: 드래그 앤 드롭 업로드 (17개 형식 지원)
- ✅ **URL**: YouTube, 치지직 등 온라인 영상 (yt-dlp + streamlink)

**편집 기능**:
- ✅ **타임라인 편집기**: 핸들 드래그, 플레이헤드, 오디오 파형, 줌 (0.1x-10x)
- ✅ **키보드 단축키**: Space (재생), I/O (In/Out), 화살표 (1초), Shift+화살표 (0.1초)
- ✅ **미리보기**: 가장자리 (처음 5초 + 마지막 5초)
- ✅ **프레임 단위 탐색**: Shift+화살표로 0.1초 단위 이동

**트리밍 방법**:
- ✅ **하이브리드 자동 선택**: MP4Box (빠름, ±1-2초) / FFmpeg (정확, ±0.02초)
- ✅ **URL 영상**: SSE 기반 비동기 다운로드, 플랫폼별 최적화 전략

**개인정보 보호**:
- ✅ **완전한 클라이언트 사이드**: 로컬 파일은 서버 업로드 없음
- ✅ **URL 영상**: 서버에서 처리하지만 스트리밍으로 브라우저 전달

### 기술적 특징

- **Next.js 16** (App Router, Turbopack)
- **Zustand** 단일 스토어 상태 관리
- **Phase-based workflow**: idle → uploading → editing → processing → completed
- **Feature-based organization**: upload, url-input, player, timeline, export
- **자동 의존성 관리**: ffmpeg, yt-dlp, streamlink 자동 다운로드

---

## 기술 스택

### 핵심 기술

| 기술 | 버전 | 목적 |
|------|------|------|
| **Next.js** | 16.1.1 | React 프레임워크, App Router |
| **React** | 19.x | UI 라이브러리 |
| **TypeScript** | 5.x | 타입 안전성 |
| **Turbopack** | 내장 | 빠른 개발 빌드 |
| **Zustand** | 5.x | 상태 관리 |
| **Tailwind CSS** | 4.x | 스타일링 |

### 비디오 처리

| 기술 | 역할 | 성능 |
|------|------|------|
| **MP4Box.js** | 로컬 파일 트리밍 (주요) | 500MB 파일 2-5초 |
| **FFmpeg.wasm** | 로컬 파일 트리밍 (대체) | 500MB 파일 30-60초 |
| **Video.js** | 비디오 재생 | 부드러운 재생 |
| **wavesurfer.js** | 오디오 파형 시각화 | 실시간 렌더링 |
| **yt-dlp** | URL 해석 | 자동 다운로드 |
| **streamlink** | HLS 트리밍 | 자동 다운로드 |
| **ffmpeg (CLI)** | 서버 트리밍 | 번들 포함 |

### 테스팅

| 기술 | 목적 |
|------|------|
| **Vitest** | 유닛 테스팅 (149개) |
| **Playwright** | E2E 테스팅 |

---

## 아키텍처

### 1. 상태 관리 (Zustand)

**단일 스토어 패턴**: `src/stores/useStore.ts`

**Phase 기반 워크플로우**:
```
idle → uploading → editing → processing → completed
  ↓                                          ↓
error ←──────────────────────────────────────┘
```

**상태 구조**:
```typescript
{
  phase: 'idle' | 'uploading' | 'editing' | 'processing' | 'completed' | 'error',
  videoFile: {
    source: 'file' | 'url',    // 파일 또는 URL 소스
    file: File | null,          // null for URL sources
    url: string,                // Object URL or proxy URL
    originalUrl?: string,       // URL sources only
    streamType?: 'hls' | 'mp4', // URL sources only
    // ... 메타데이터
  },
  timeline: { inPoint, outPoint, currentTime, zoom, locks },
  processing: { uploadProgress, trimProgress, waveformProgress },
  player: { isPlaying, isScrubbing, isSeeking },
  error: { errorMessage, errorCode },
  export: { trimmedUrl, filename },
  downloadPhase: string | null,  // URL 다운로드 진행 phase
  downloadProgress: number,
}
```

**Selector 패턴** (`src/stores/selectors.ts`, `src/stores/selectorFactory.ts`):
- `useTimelineState()` - 타임라인 데이터
- `useTimelineActions()` - 타임라인 액션
- `usePlayerState()` - 플레이어 상태
- `usePhase()` - 현재 phase
- `useVideoSource()` - 비디오 소스 타입
- `useDownloadPhase()` - 다운로드 phase
- `useShallow` 사용으로 불필요한 리렌더링 방지

### 2. 기능별 구조

```
src/
├── features/
│   ├── upload/          # 파일 업로드, 드래그 앤 드롭
│   │   ├── components/  UploadZone, UploadProgress
│   │   ├── hooks/       useFileUpload
│   │   └── utils/       validateFile
│   │
│   ├── url-input/       # URL 입력 (2026-02-08, 리팩토링 2026-02-12)
│   │   ├── components/
│   │   │   ├── UrlInputZone.tsx
│   │   │   ├── UrlPreviewSection.tsx
│   │   │   ├── UrlPreviewCard.tsx
│   │   │   └── UrlPreviewRangeControl.tsx
│   │   ├── hooks/
│   │   │   ├── useUrlInput.ts
│   │   │   ├── useUrlDownload.ts
│   │   │   └── useStreamDownload.ts
│   │   └── utils/
│   │       └── sseProgressUtils.ts
│   │
│   ├── player/          # Video.js 플레이어
│   │   ├── components/  VideoPlayerView
│   │   └── context/     VideoPlayerContext
│   │
│   ├── timeline/        # 타임라인 에디터
│   │   ├── components/
│   │   │   ├── TimelineEditor.tsx       (64줄, 오케스트레이터)
│   │   │   ├── TrimHandle.tsx           (통합 In/Out 핸들)
│   │   │   ├── Playhead.tsx             (~145줄)
│   │   │   ├── TimelineControls.tsx
│   │   │   ├── PreviewButtons.tsx
│   │   │   └── WaveformBackground.tsx
│   │   ├── hooks/
│   │   │   ├── useDragHandle.ts
│   │   │   ├── useKeyboardShortcuts.ts
│   │   │   ├── usePreviewPlayback.ts
│   │   │   ├── useTimelineZoom.ts
│   │   │   └── usePlayheadSeek.ts
│   │   └── utils/
│   │       ├── timeFormatter.ts
│   │       └── constrainPosition.ts
│   │
│   └── export/          # 내보내기 및 트리밍
│       ├── components/
│       │   ├── ExportButton.tsx
│       │   ├── ExportProgress.tsx       (지연 로딩)
│       │   ├── DownloadButton.tsx       (지연 로딩)
│       │   └── ErrorDisplay.tsx
│       ├── hooks/
│       │   └── useExportState.ts
│       └── utils/
│           ├── trimVideoDispatcher.ts
│           ├── trimVideoMP4Box.ts
│           ├── trimVideoFFmpeg.ts
│           ├── generateFilename.ts      (트림 구간 포함 파일명)
│           ├── mp4boxHelpers.ts
│           └── FFmpegSingleton.ts
│
├── lib/                 # 공통 유틸리티
│   ├── binPaths.ts          # 바이너리 경로 해석
│   ├── downloadJob.ts       # 다운로드 Job 오케스트레이터
│   ├── downloadTypes.ts     # DownloadProgressTracker 공통 클래스
│   ├── streamlinkDownloader.ts  # Chzzk 다운로더 (2-phase)
│   ├── ytdlpDownloader.ts       # YouTube/Generic 다운로더 (1-phase)
│   ├── platformDetector.ts  # 도메인 기반 플랫폼 감지
│   ├── progressParser.ts    # Streamlink/FFmpeg stdout 파싱
│   ├── formatSelector.ts    # yt-dlp 포맷 선택
│   ├── streamUtils.ts       # ensureFileComplete() 등
│   ├── cleanup.ts           # Cleanup 레지스트리
│   ├── processUtils.ts      # 프로세스 타임아웃/종료
│   └── apiErrorHandler.ts   # API 에러 처리
│
└── stores/              # 상태 관리
    ├── useStore.ts
    ├── selectors.ts
    └── selectorFactory.ts
```

### 3. 비디오 처리 흐름

#### 로컬 파일 편집

```
1. 업로드 (idle → uploading → editing)
   - 드래그 앤 드롭 / 파일 선택
   - validateFile() 검증 (형식, 크기)
   - Object URL 생성
   - phase: 'editing'

2. 편집 (editing)
   - Video.js 플레이어 초기화
   - WaveformBackground 오디오 로드
   - TimelineEditor로 In/Out Point 설정
   - 미리보기, 줌, 키보드 단축키

3. 내보내기 (editing → processing → completed)
   - trimVideoDispatcher() 방법 선택:
     • 짧은 클립 (≤60초) + 작은 파일 (≤100MB): FFmpeg (±0.02초)
     • 긴 클립 또는 큰 파일: MP4Box (2-5초, ±1-2초)
   - 진행률 추적
   - Blob URL 생성
   - phase: 'completed'

4. 다운로드/재설정
   - 파일명: {원본파일명}(MMmSSs-MMmSSs).{확장자}
   - URL.revokeObjectURL() 정리
   - 재설정 버튼으로 idle 복귀
```

#### URL 영상 편집 (2026-02-08, SSE 전환 2026-02-14)

```
1. URL 입력 (idle → uploading → editing)
   - POST /api/video/resolve
   - yt-dlp로 메타데이터 + 스트림 URL 추출
   - streamType 결정 (HLS or MP4)
   - VideoFile 생성 (source: 'url')

2. 재생 (editing)
   - HLS: 직접 URL 사용
   - MP4: /api/video/proxy?url=<encoded> 프록시
   - Video.js 플레이어 초기화
   - Range 요청 지원으로 시킹 가능

3. 다운로드 (editing → processing → completed)
   - POST /api/download/start → jobId 즉시 반환
   - GET /api/download/stream/:jobId → SSE 실시간 진행률
   - 플랫폼별 전략 자동 선택:
     • Chzzk: Streamlink 2-phase (downloading + processing)
     • YouTube/Generic: yt-dlp 1-phase (downloading only)
   - GET /api/download/:jobId → 완성 파일 다운로드

4. 의존성 관리
   - yt-dlp: system > .bin/yt-dlp > yt-dlp-wrap
   - streamlink: bundled (.bin/streamlink-venv) > system (postinstall 자동 설치)
   - ffmpeg: @ffmpeg-installer/ffmpeg (v4.4 번들)
   - ffmpeg.wasm: @ffmpeg/core → public/ffmpeg/ (자체 호스팅, CDN 미사용)
```

### 4. 플레이어-타임라인 동기화

**경쟁 조건 방지 패턴**:

사용자가 플레이헤드를 드래그하는 동안, 비디오 플레이어는 계속 `timeupdate` 이벤트를 발생시킵니다.
이 두 이벤트가 동시에 `currentTime`을 업데이트하려 하면 플레이헤드가 튀는 현상 발생.

**해결 방법** (`isScrubbing` 플래그):

```
// 드래그 시작
사용자가 플레이헤드 드래그 시작 → isScrubbing = true

// 드래그 중
매 프레임마다:
  IF isScrubbing:
    플레이헤드 위치만 업데이트 (스토어 X)

// 비디오 이벤트 무시
video.timeupdate 이벤트 발생 시:
  IF isScrubbing OR video.seeking:
    이벤트 무시 (스토어 업데이트 안 함)  // 핵심!
  ELSE:
    currentTime 스토어 업데이트

// 드래그 종료
사용자가 드래그 종료 → isScrubbing = false → 정상 동기화 재개
```

**구현**: `src/features/timeline/components/Playhead.tsx`, `src/features/player/components/VideoPlayerView.tsx`

### 5. 핵심 설계 패턴

#### 통합 컴포넌트 (TrimHandle)

**문제**: InPointHandle + OutPointHandle 85% 중복 (130줄)

**해결**: `type` prop으로 단일 컴포넌트 (85줄)

```typescript
<TrimHandle type="in" />   // In Point
<TrimHandle type="out" />  // Out Point
```

#### 지연 로딩 (코드 분할)

```typescript
const ExportProgress = lazy(() => import('./ExportProgress'));
const DownloadButton = lazy(() => import('./DownloadButton'));

<Suspense fallback={null}>
  {phase === 'processing' && <ExportProgress />}
  {phase === 'completed' && <DownloadButton />}
</Suspense>
```

**효과**: 초기 번들 크기 감소

### 6. 메모리 관리

#### Object URL 생명주기

```typescript
// 스토어 reset
reset: () => {
  const { videoFile, export: exportState } = get();

  // URL 소스는 Object URL이 아니므로 revoke 스킵
  if (videoFile?.source === 'file' && videoFile.url) {
    URL.revokeObjectURL(videoFile.url);
  }

  // 내보내기 결과는 항상 Blob URL
  if (exportState.trimmedUrl) {
    URL.revokeObjectURL(exportState.trimmedUrl);
  }

  set(initialState);
}
```

#### Cleanup 레지스트리 (`src/lib/cleanup.ts`)

Store가 Features를 직접 참조하지 않고 cleanup 함수를 등록해두는 패턴:

```typescript
// 모듈 로드 시 등록
registerCleanup(() => FFmpegSingleton.cleanup());

// Store reset 시 호출
reset: () => {
  runAllCleanups();  // 레지스트리만 의존
  set(initialState);
}
```

### 7. 오류 처리

**중앙 집중식 핸들러** (`src/utils/errorHandler.ts`):

```typescript
export type VideoTrimError =
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'CORRUPTED_FILE'
  | 'MEMORY_EXCEEDED'
  | 'BROWSER_NOT_SUPPORTED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';
```

**ErrorDisplay 컴포넌트**:
- 사용자 친화적 메시지
- 실행 가능한 제안
- 복구 옵션 (재시도, 재설정)
- 기술 세부사항 (접을 수 있음)

### 8. 의존성 관리

**자동 다운로드** (`scripts/setup-deps.mjs`):
- `npm install` 시 postinstall 훅으로 자동 다운로드
- 플랫폼별 바이너리 (Windows: .zip, Linux: AppImage, macOS: system)

**경로 해석** (`src/lib/binPaths.ts`):

| 바이너리 | 우선순위 |
|---------|----------|
| FFmpeg | 번들 (`@ffmpeg-installer`) → 시스템 (`ffmpeg`) |
| yt-dlp | 시스템 (`yt-dlp`) → 번들 (`.bin/yt-dlp`) → npm (`yt-dlp-wrap`) |
| Streamlink | 번들 (`.bin/streamlink`) → 시스템 (`streamlink`) |

**플랫폼별 전략**:
- **Windows**: streamlink portable .zip → `adm-zip` 압축 해제
- **Linux**: streamlink AppImage (x64/ARM64) → `--appimage-extract-and-run`
- **macOS**: Python venv 자동 설치 (`.bin/streamlink-venv/`) → `brew install streamlink` 불필요

---

> 💡 **Claude Code 개발자**: 구현 세부사항은 `/CLAUDE.md`를 참조하세요.
> 특히 Player-Timeline Synchronization, Scrubbing State Management, Memory Management 패턴.

---

## 개발 워크플로

### 명령어

```bash
# 개발
npm run dev           # 개발 서버 시작 (localhost:3000, Turbopack)
npm run build         # 프로덕션 빌드
npm start             # 프로덕션 서버 시작
npm run lint          # ESLint 실행
npm run type-check    # TypeScript 타입 체크

# 테스팅
npm test              # Vitest 유닛 테스트 (149개)
npm run test:ui       # Vitest UI
npm run test:coverage # 커버리지 리포트
npm run test:e2e      # Playwright E2E (대부분 스킵)
npm run test:e2e:ui   # Playwright UI
```

### 환경 변수

```bash
# .env.local (선택적)
NEXT_PUBLIC_MAX_FILE_SIZE=5368709120  # 5GB (기본값)
```

---

## 성능 특성

### 트리밍 속도

| 파일 크기 | MP4Box (스트림 복사) | FFmpeg (스트림 복사) | FFmpeg (재인코딩) |
|-----------|---------------------|---------------------|-------------------|
| 100MB     | ~1초                | ~3초                | ~15초             |
| 500MB     | ~3초                | ~10초               | ~60초             |
| 1GB       | ~5초                | ~20초               | ~2분              |

**하이브리드 디스패처**: 최적 방법 자동 선택

### 트리밍 정확도

| 방법 | 정확도 | 사용 사례 |
|------|--------|----------|
| MP4Box | ±1-2초 (키프레임) | 빠른 트리밍, 긴 클립 |
| FFmpeg | ±0.02초 (거의 프레임 단위) | 정밀 트리밍, 짧은 클립 |
| Streamlink | ±1초 (세그먼트) | URL 영상 (Chzzk HLS) |

### URL 다운로드 속도 (1분 영상 기준)

| 플랫폼 | 시간 | 방법 | 병목 |
|--------|------|------|------|
| **Chzzk** | 15-20초 | Streamlink (HLS 세그먼트 병렬) | 네트워크 |
| **YouTube** | ~30-32초 | yt-dlp (구간 다운로드 + FFmpeg 통합) | FFmpeg 구간 추출 |

**YouTube 성능 상세** (2026-02-17 최적화 후):
- 1-phase 최적화로 기존 ~36초에서 **~30-32초**로 단축 (~15% 개선)
- `--postprocessor-args`로 Phase 2 FFmpeg를 yt-dlp 내부에 통합
- 병목: `--download-sections`의 내부 FFmpeg 구간 추출 (최적화 불가)
- 설계 의도: 긴 영상(1시간+)에서 효율적 (30초 vs 전체 다운로드 4분+)

### 메모리 사용

| 크기 범위 | 상태 | 설명 |
|-----------|------|------|
| < 500MB | ✅ 권장 | 안전한 처리 |
| 500MB - 1GB | ⚠️ 경고 | 처리 가능하지만 주의 |
| 1GB - 2GB | 🟠 소프트 | 메모리 체크 필요 |
| 2GB - 5GB | 🔴 위험 | 메모리 부족 가능성 높음 |
| > 5GB | ⛔ 차단 | 절대 제한 |

---

## 제약사항 및 한계

### 기술적 제약

1. **키프레임 정확도 (MP4Box)**:
   - ±1-2초 정확도 (키프레임 기반)
   - 짧은 클립은 FFmpeg로 자동 전환

2. **브라우저 메모리**:
   - 큰 파일 (>1GB) 속도 저하 가능
   - 5GB 하드 제한

3. **HLS 트리밍 (Streamlink)**:
   - 세그먼트 기반, 약간의 부정확성
   - streamlink 설치 필요 (자동 다운로드)

4. **형식 호환성**:
   - MP4Box는 MP4 최적화
   - 다른 형식은 FFmpeg 사용
   - 일부 희귀 코덱 미지원

### 설계 결정

1. **서버 업로드 없음**:
   - 완전한 클라이언트 사이드 (개인정보 보호)
   - URL 영상은 서버 트리밍 (스트리밍 특성상 불가피)

2. **단일 트리밍 범위**:
   - 하나의 In Point, 하나의 Out Point
   - 멀티 클립 편집 없음

3. **데스크톱 중심**:
   - 모바일은 브라우저 기능 제한
   - 큰 파일은 데스크톱 권장

### 브라우저 지원

**최소 요구사항**:
- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- File API, Blob URL, ES2020+

**권장**:
- 최신 Chrome/Edge
- 4GB+ RAM
- 좋은 CPU (FFmpeg 재인코딩 시)

**지원 안 함**:
- Internet Explorer (모든 버전)

### 지원 형식

**입력** (17개 형식):
- **Core**: MP4 ✅ (최고 성능 - MP4Box 최적화), WebM ✅, OGG ✅
- **Apple/QuickTime**: MOV ✅, M4V ✅
- **Microsoft/Windows**: AVI ✅, WMV ✅
- **Matroska**: MKV ✅
- **Streaming/Mobile**: FLV ✅, TS ✅, 3GP ✅, 3G2 ✅
- **MPEG variants**: MPEG ✅, MPG ✅

**출력**: 입력 형식 유지 (stream copy)

---

## 문서 구조

```
.docs/
├── 00_INDEX.md          # 문서 안내/인덱스
├── 01_OVERVIEW.md       # 이 문서 (프로젝트 기술 개요)
├── 02_API.md            # API 레퍼런스
├── 03_DEPENDENCIES.md   # 외부 의존성 관리 (FFmpeg, yt-dlp, Streamlink)
├── 04_DEVELOPER_GUIDE.md # 개발자 학습 가이드
└── 05_HISTORY.md        # 개발 히스토리
```

**루트 레벨**:
- `README.md` - 프로젝트 개요, 설치, 사용법
- `CLAUDE.md` - Claude Code 가이드 (Quick Reference)
