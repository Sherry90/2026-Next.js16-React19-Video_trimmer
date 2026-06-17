# Video Trimmer - 프로젝트 개요

---

## 목차

1. [기술 개념](#기술-개념)
2. [개요](#개요)
3. [기술 스택](#기술-스택)
4. [아키텍처](#아키텍처)
5. [비디오 처리 흐름](#비디오-처리-흐름)
6. [번들 전략](#번들-전략)
7. [성능 특성](#성능-특성)
8. [제약사항 및 한계](#제약사항-및-한계)
9. [문서 구조](#문서-구조)

---

## 기술 개념

> 💡 이미 익숙한 개념은 건너뛰어도 됩니다.

### 비디오 처리

| 기술 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **MP4Box.js** | 재인코딩 없는 MP4 트리밍 | 빠름, 품질 유지 | ±1-2초 정확도 (키프레임) |
| **FFmpeg.wasm** | 브라우저 내 비디오 변환 | ±0.02초 정확도 | 느림, WASM 로드 필요 |
| **HLS** | 적응형 세그먼트 스트리밍 | 부분 재생/시킹 | 세그먼트 단위 |
| **Stream Copy** | 재인코딩 없는 재패키징 | 품질 손실 없음, 빠름 | 키프레임 의존 |

### 상태 관리 & 브라우저 API

| 기술/패턴 | 설명 | 프로젝트 사용 |
|-----------|------|---------------|
| **Zustand** | 최소주의 상태 관리 | 단일 스토어 (`useStore.ts`) |
| **Selector Pattern** | 특정 슬라이스만 구독 | `useShallow` 최적화 |
| **Race Condition 제어** | 경쟁적 상태 업데이트 방지 | `isScrubbing` 플래그 |
| **COEP** | Cross-origin 격리 | `credentialless` (SAB 허용) |
| **SharedArrayBuffer** | Worker 간 메모리 공유 | FFmpeg.wasm 멀티스레드 |
| **Code Splitting** | 지연 로딩으로 번들 분리 | `React.lazy` (에디터/내보내기) |

### 아키텍처 패턴

| 패턴 | 설명 | 예시 |
|------|------|------|
| **Layered (FSD 정렬)** | features / widgets / shared 계층 | `widgets/EditingSection` |
| **Dispatcher** | 조건별 구현체 자동 선택 | MP4Box vs FFmpeg.wasm vs 서버 |
| **Strategy** | 런타임 알고리즘 선택 | Chzzk → Streamlink, YouTube → yt-dlp |
| **Phase-based Workflow** | FSM 상태 관리 | idle → editing → completed |
| **Streaming Editor** | 다운로드 전 스트림 위 편집 | URL 소스 편집 |

### 용어

| 한국어 | 영어 | 설명 |
|--------|------|------|
| 트리밍 | Trimming | 비디오 구간 잘라내기 |
| 인/아웃 포인트 | In/Out Point | 트리밍 시작/종료 지점 |
| 플레이헤드 | Playhead | 현재 재생 위치 |
| 스크러빙 | Scrubbing | 플레이헤드 드래그 탐색 |

---

## 개요

**Video Trimmer**는 브라우저에서 동영상을 트리밍하는 클라이언트 사이드 웹 애플리케이션이다. 로컬 파일은 서버 업로드 없이 브라우저에서 직접 처리하고, URL 영상은 다운로드 전에 스트림 위에서 구간을 정한 뒤 확정 시점에만 해당 구간을 서버에서 받아 디스크로 직행 전달한다.

### 핵심 기능

**입력**
- **로컬 파일**: 드래그 앤 드롭 업로드 (14개 형식)
- **URL**: YouTube, 치지직 등 온라인 영상

**편집**
- 타임라인 에디터: 핸들 드래그, 플레이헤드, 오디오 파형, 줌(0.1x–10x)
- 키보드 단축키: Space, I/O, 화살표(1초), Shift+화살표(0.1초), Home/End, A(미리보기)
- 미리보기: 선택 구간의 처음 5초 + 마지막 5초

**트리밍**
- 로컬 파일: 형식에 따라 MP4Box 또는 FFmpeg.wasm 자동 선택
- URL 영상: 확정 구간을 서버에서 다운로드(SSE 진행률), 플랫폼별 전략

**개인정보**
- 로컬 파일은 서버 업로드 없음(완전 클라이언트 사이드)
- URL 영상은 서버에서 구간만 받아 브라우저를 거치지 않고 디스크로 직행

### 기술적 특징

- **Next.js 16** (App Router, Turbopack)
- **Zustand** 단일 스토어 + selector
- **Phase 기반 워크플로**: idle → uploading → editing → processing → completed | error
- **계층 구조**: `features/` · `widgets/` · `shared/`
- **자동 의존성 관리**: ffmpeg, yt-dlp, streamlink 자동 다운로드

---

## 기술 스택

### 핵심

| 기술 | 버전 | 목적 |
|------|------|------|
| **Next.js** | 16.2.9 | React 프레임워크, App Router, API Routes |
| **React** | 19.x | UI 라이브러리 |
| **TypeScript** | 5.x | 타입 안전성 |
| **Zustand** | 5.x | 상태 관리 |
| **Tailwind CSS** | 4.x | 스타일링 |

### 비디오 처리

| 기술 | 버전 | 역할 |
|------|------|------|
| **MP4Box.js** | — | 로컬 ISO 파일 트리밍 (주 경로) |
| **FFmpeg.wasm** | `@ffmpeg/*` | 로컬 비-ISO 파일 트리밍 (대체) |
| **video.js** | 8.x | 비디오 재생 (HLS 포함) |
| **wavesurfer.js** | 7.x | 오디오 파형 렌더 |
| **yt-dlp** | 핀 버전 | URL 메타데이터/스트림 추출, YouTube/Generic 다운로드 |
| **streamlink** | 자동 설치 | Chzzk HLS 구간 다운로드 |
| **ffmpeg (CLI)** | `@ffmpeg-installer` | 서버 측 구간 추출/타임스탬프 처리 |

### 테스팅

| 기술 | 목적 |
|------|------|
| **Vitest** | 유닛 테스트 (194개, happy-dom) |
| **Playwright** | E2E (핵심 워크플로) |

---

## 아키텍처

### 1. 상태 관리 (Zustand)

**단일 스토어**: `src/stores/useStore.ts`

**Phase 워크플로**:
```
idle → uploading → editing → processing → completed
  ↑                                          │
  └──────────────── error ←──────────────────┘
```

**상태 구조(요약)**:
```typescript
{
  phase: 'idle' | 'uploading' | 'editing' | 'processing' | 'completed' | 'error',
  videoFile: {
    source: 'file' | 'url',     // 소스 구분
    file: File | null,           // URL 소스는 null
    url: string,                 // Object URL(파일) 또는 프록시 URL(URL)
    originalUrl?: string,        // URL 소스 전용 (다운로드 재해석용)
    streamUrl?: string,          // resolve가 추출한 실제 스트림 URL
    streamType?: 'hls' | 'mp4',  // 재생 전략 결정
    duration, thumbnail, tbr, ...
  },
  timeline: { inPoint, outPoint, playhead, zoom, isInPointLocked, isOutPointLocked },
  processing: { uploadProgress, trimProgress, waveformProgress, downloadPhase, downloadMessage, activeDownloadJobId },
  player: { isPlaying, currentTime, volume, isMuted, isScrubbing },
  error: { hasError, errorMessage, errorCode },
  export: { outputUrl, outputFilename },
}
```

**Selector**(`src/stores/selectors.ts`, `selectorFactory.ts`): `useTimelineState`, `useTimelineActions`, `useTrimPoints`, `useVideoFile`, `useVideoUrl`, `useVideoDuration`, `usePlayerActions`, `usePhase`, `useCommonActions`, `useProgressActions`. `useShallow`로 불필요한 리렌더 방지. 세분화 단일 필드 셀렉터는 정리됨 — 필요하면 `useStore((s) => s.…)`로 직접 구독한다.

### 2. 계층 구조

```
src/
├── features/                # 기능 모듈
│   ├── upload/              # 파일 업로드 (UploadZone, useFileUpload, validateFile)
│   ├── url-input/           # URL 입력
│   │   ├── components/      UrlInputZone
│   │   └── hooks/           useUrlInput
│   ├── player/              # video.js 플레이어
│   │   ├── components/      VideoPlayerView   (player 인스턴스를 context로 노출)
│   │   └── context/         VideoPlayerContext
│   ├── timeline/            # 타임라인 에디터
│   │   ├── components/      TimelineEditor, TrimHandle, Playhead, TimelineControls,
│   │   │                    PreviewButtons, WaveformBackground
│   │   └── hooks/           useDragHandle, useKeyboardShortcuts, usePreviewPlayback,
│   │                        useTimelineZoom, usePlayheadSeek
│   └── export/              # 내보내기 및 트리밍
│       ├── components/      ExportButton, ExportProgress, DownloadButton, ErrorDisplay
│       ├── hooks/           useExportState, useFFmpegLoader
│       └── utils/           trimVideoDispatcher, trimVideoMP4Box, trimVideoFFmpeg,
│                            trimVideoServer, FFmpegSingleton, formatDetector, generateFilename,
│                            streamDownloadController, sseProgressUtils
│
├── widgets/                 # feature 합성 위젯
│   └── EditingSection.tsx   # VideoPlayerView + TimelineEditor + 키보드 단축키
│
├── shared/                  # 클라이언트 공유 (상위 레이어 미참조 leaf)
│   ├── ui/ProgressBar.tsx   # 재사용 UI 프리미티브
│   └── lib/                 # 순수 유틸: waveformCache, platformUrl, timeFormatter,
│                            mathUtils, stringUtils, formatBytes, errorHandler, ffmpegLogParser, memoryMonitor
│
├── lib/                     # 서버 전용 유틸리티
│   ├── binPaths.ts          # 바이너리 경로 해석
│   ├── downloadJob.ts       # 다운로드 Job 오케스트레이터 (플랫폼 전략 선택)
│   ├── streamlinkDownloader.ts / ytdlpDownloader.ts / platformDetector.ts
│   ├── progressParser.ts / formatSelector.ts / downloadTypes.ts
│   ├── hlsProxy.ts          # m3u8 세그먼트 URI 재작성
│   ├── streamUtils.ts       # 파일 스트리밍 (Content-Disposition 등)
│   └── cleanup.ts           # cleanup 레지스트리
│
├── stores/                  # Zustand 스토어 + selector
├── constants/ types/        # 설정·타입 (apiUtils 등 서버 유틸은 lib/로 이동, src/utils 제거됨)
└── app/                     # App Router (page, layout, api routes)
```

### 3. 플레이어-타임라인 동기화

사용자가 플레이헤드를 드래그하거나 미리보기로 프로그램적 seek을 하는 동안, 플레이어는 `timeupdate`를 계속 발생시킨다. 두 경로가 동시에 `currentTime`을 쓰면 플레이헤드가 튄다.

**해결**(`isScrubbing` 플래그):
```
video.timeupdate 발생 시:
  IF isScrubbing OR video.seeking():
    무시 (스토어 미갱신)        ← 핵심
  ELSE:
    currentTime 스토어 갱신 + outPoint 도달 시 자동 정지
```
구현: `Playhead.tsx`(드래그), `VideoPlayerView.tsx`(timeupdate 가드), `usePreviewPlayback.ts`(프로그램적 seek 동안 `isScrubbing` true).

### 4. 핵심 설계 패턴

**통합 핸들 (TrimHandle)**: `type` prop 하나로 In/Out 핸들을 단일 컴포넌트로 처리.
```tsx
<TrimHandle type="in" /> <TrimHandle type="out" />
```

**플레이어 인스턴스 노출**: `VideoPlayerView`가 video.js player를 React state로 보관해 context(`useVideoPlayerContext`)로 제공한다. 소비자(`usePreviewPlayback`, 키보드 단축키 등)는 항상 실제 player 인스턴스를 받는다. context value는 `useMemo`로 안정화한다.

**Buffer-aware 미리보기**(`usePreviewPlayback.ts`): 스트리밍 소스는 seek 후 타겟 세그먼트가 버퍼링되어야 재생 가능하다. `seekAndPlay`는 seek → `seeked` + 준비(`readyState`/`canplay`) 대기 → `play()` 순으로 진행하고, 프로그램적 seek 동안 `isScrubbing`을 켜 경합을 막는다. 안전 타임아웃으로 stuck을 방지한다. 버튼·키보드 미리보기가 동일 경로를 공유한다.

**Cleanup 레지스트리**(`lib/cleanup.ts`): 스토어가 feature를 직접 참조하지 않고, 모듈이 cleanup 함수를 등록한다.
```typescript
registerCleanup(() => FFmpegSingleton.cleanup());   // 모듈 로드 시
reset: () => { runAllCleanups(); set(initialState); } // 스토어 reset 시
```

### 5. 메모리 관리

- **Object URL**: 파일 소스는 `URL.createObjectURL`/`revokeObjectURL`로 관리. URL 소스의 `videoFile.url`은 프록시 문자열이라 revoke 대상 아님.
- **서버 파일 정리**: URL 다운로드 결과(`outputUrl = /api/download/:jobId`)는 reset 시 `DELETE /api/download/:jobId`로 서버 임시 파일을 정리.
- **dispose**: video.js `player.dispose()`, wavesurfer `destroy()`를 언마운트 시 호출.

---

## 비디오 처리 흐름

### 로컬 파일

```
1. 업로드 (idle → uploading → editing)
   - 드래그 앤 드롭 / 파일 선택 → validateFile() (형식·크기)
   - Object URL 생성 → phase: editing

2. 편집 (editing)
   - video.js 초기화, WaveformBackground가 로컬 미디어에서 파형 디코드
   - TimelineEditor로 In/Out 설정, 미리보기·줌·단축키

3. 내보내기 (editing → processing → completed)
   - trimVideoDispatcher가 형식으로 방법 선택:
       ISO(mp4/mov/m4v) → MP4Box.js (재인코딩 없음, ±1-2초)
       그 외           → FFmpeg.wasm (WASM 로드, ±0.02초)
   - Blob 생성 → Object URL → phase: completed

4. 다운로드/재설정
   - 파일명: {원본}(MMmSSs-MMmSSs).{확장자}
   - revokeObjectURL 정리 후 idle 복귀
```

### URL 영상 (스트리밍 에디터)

URL 소스는 **다운로드 전에** 스트림 위에서 바로 편집한다. 미리보기에서 구간을 옮기는 것이 곧 전체 소스에 대한 구간 editing이며, 확정 시점에만 해당 구간을 받는다.

```
1. URL 입력 (idle → editing)
   - POST /api/video/resolve → yt-dlp 메타데이터 + 스트림 URL (HLS 우선)
   - VideoFile 생성 (source: 'url', streamType, originalUrl)
   - resolve와 병렬로 /api/video/waveform prefetch 시작

2. 편집 (editing) — 전체 소스 위 구간 선택
   - HLS: 프록시가 m3u8 내부 세그먼트 URI를 /api/video/proxy 경유로 재작성 (CORS)
   - MP4: /api/video/proxy?url=… 로 Range 패스스루
   - WaveformBackground는 prefetch된 서버 peaks를 소비 (영상 전체 다운로드 없음)

3. 다운로드 (editing → processing → completed)
   - 확정 시 streamDownloadController가 originalUrl + in/out으로
     POST /api/download/start → jobId
   - GET /api/download/stream/:jobId → SSE 실시간 진행률
       Chzzk:          Streamlink (2-phase: 구간 추출 → 타임스탬프 리셋)
       YouTube/Generic: yt-dlp (1-phase: 구간 다운로드 + 후처리 통합)
   - 완료 시 outputUrl = /api/download/:jobId
   - 브라우저는 <a download>로 서버에서 디스크로 직행 (JS 힙 blob 없음)

4. 재설정
   - reset 시 DELETE /api/download/:jobId 로 서버 임시 파일 정리
```

URL 편집은 사실상 스크립트/UI 편집이므로, 최종 출력 크기가 브라우저 메모리가 아니라 서버 임시 디스크와 다운로드 시간에만 좌우된다.

---

## 번들 전략

에디터는 video.js와 wavesurfer 등 큰 미디어 라이브러리에 의존한다. 랜딩/업로드 화면에서는 이들이 필요 없으므로 **에디터를 지연 로딩**한다.

```tsx
const EditingSection = lazy(() => import('@/widgets/EditingSection') …);
const ExportProgress = lazy(() => import('@/features/export/components/ExportProgress') …);
const DownloadButton = lazy(() => import('@/features/export/components/DownloadButton') …);

{phase === 'editing' && (
  <Suspense fallback={…}><EditingSection /></Suspense>
)}
```

**효과**: video.js(가장 큰 청크) + wavesurfer가 editing 진입 시점에만 로드되어 초기 진입 번들이 크게 줄어든다. 내보내기 진행/다운로드 UI도 해당 phase에서만 로드된다.

FFmpeg.wasm 코어는 CDN이 아니라 `public/ffmpeg/`에서 자체 호스팅하며, 비-ISO 파일 내보내기 시점에만 런타임 로드된다.

---

## 성능 특성

### 트리밍 (로컬 파일, stream copy 기준)

| 파일 크기 | MP4Box | FFmpeg.wasm |
|-----------|--------|-------------|
| 100MB | ~1초 | ~3초 |
| 500MB | ~3초 | ~10초 |
| 1GB | ~5초 | ~20초 |

| 방법 | 정확도 | 사용 |
|------|--------|------|
| MP4Box | ±1-2초 (키프레임) | ISO 형식 |
| FFmpeg.wasm | ±0.02초 | 그 외 형식 |

### URL 구간 다운로드 (1분 영상 기준)

| 플랫폼 | 시간 | 방법 | 병목 |
|--------|------|------|------|
| **Chzzk** | 15–20초 | Streamlink (세그먼트 병렬) | 네트워크 |
| **YouTube** | 짧은 클립 수 초 | yt-dlp (byte-range 우선, 폴백 전체 다운로드 + 로컬 컷) | 네트워크 |

YouTube는 `--download-sections`를 쓰지 않는다(yt-dlp가 구간을 ffmpeg로 직렬 추출해 연결당 스로틀에 묶임). 대신 ① DASH 단일파일 표현의 `sidx`를 파싱해 **구간 바이트만** 받아 로컬 컷(`byteRangeDownloader.ts`), 실패 시 ② 선택 포맷 **전체**를 aria2c 다중연결로 받아(스로틀 우회) 로컬 ffmpeg로 컷한다. 둘 다 스트림 카피라 재인코딩이 없다.

### 메모리 (로컬 파일)

| 범위 | 상태 |
|------|------|
| < 500MB | ✅ 권장 |
| 500MB–1GB | ⚠️ 경고 |
| 1–2GB | 🟠 소프트(메모리 체크) |
| 2–5GB | 🔴 위험 |
| > 5GB | ⛔ 차단 |

URL 소스는 브라우저 메모리에 적재하지 않으므로(서버→디스크 직행) 이 한계의 영향을 받지 않는다.

---

## 제약사항 및 한계

**기술**
- MP4Box는 키프레임 단위(±1-2초). 정밀이 필요한 비-ISO 형식은 FFmpeg.wasm.
- 긴 HLS 소스의 파형 추출은 전체 오디오를 받으므로 느릴 수 있다(비차단 로딩으로 보완).
- 로컬 큰 파일(>1GB)은 브라우저 메모리 영향. 5GB 하드 제한.

**설계 결정**
- 로컬 파일은 서버 업로드 없음. URL 영상은 스트리밍 특성상 서버에서 구간을 받되 브라우저 blob을 거치지 않는다.
- 단일 In/Out 구간(멀티 클립 없음).
- 데스크톱 중심(큰 파일·정밀 편집).

**지원 형식 (입력 14종)**: MP4·WebM·OGG·MOV·M4V·AVI·WMV·MKV·FLV·TS·3GP·3G2·MPEG·MPG. 출력은 입력 형식 유지(stream copy).

**브라우저**: Chrome/Edge 90+, Firefox 88+, Safari 14+ (File API, Blob URL, ES2020+). IE 미지원.

---

## 문서 구조

```
.docs/
├── 00_INDEX.md           # 문서 안내/인덱스
├── 01_OVERVIEW.md        # 이 문서 (프로젝트 기술 개요)
├── 02_API.md             # API 레퍼런스
├── 03_DEPENDENCIES.md    # 외부 의존성 관리
└── 04_DEVELOPER_GUIDE.md # 개발자 학습 가이드
```

**루트**: `README.md`(개요·설치·사용법), `CLAUDE.md`(Claude Code 가이드), `scripts/README.md`, `src/lib/README.md`.
