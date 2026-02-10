# Video Trimmer - 프로젝트 문서

> **최종 업데이트**: 2026-02-11
> **버전**: 1.0
> **상태**: ✅ 프로덕션 준비 완료

---

## 목차

1. [개요](#개요)
2. [현재 상태](#현재-상태)
3. [기술 스택](#기술-스택)
4. [아키텍처](#아키텍처)
5. [개발 워크플로](#개발-워크플로)
6. [성능 특성](#성능-특성)
7. [제약사항 및 한계](#제약사항-및-한계)
8. [배포](#배포)

---

## 개요

**Video Trimmer**는 서버 업로드 없이 브라우저에서 완전히 동영상을 트리밍할 수 있는 클라이언트 사이드 웹 애플리케이션입니다.

### 핵심 기능

- ✅ **로컬 파일 편집**: 드래그 앤 드롭, MP4Box.js 스트림 복사 (10-20배 빠름)
- ✅ **URL 영상 편집**: YouTube, 치지직 등 (yt-dlp + streamlink)
- ✅ **타임라인 편집기**: 핸들 드래그, 플레이헤드, 오디오 파형, 줌
- ✅ **키보드 단축키**: Space, I/O, 화살표, Home/End, Shift+화살표
- ✅ **하이브리드 트리밍**: MP4Box (빠름) / FFmpeg (정확) 자동 선택
- ✅ **완전한 개인정보 보호**: 서버 업로드 없음, 모든 처리가 브라우저에서

### 기술적 특징

- **Next.js 16** (App Router, Turbopack)
- **Zustand** 단일 스토어 상태 관리
- **Phase-based workflow**: idle → uploading → editing → processing → completed
- **Feature-based organization**: upload, player, timeline, export
- **자동 의존성 관리**: ffmpeg, yt-dlp, streamlink 자동 다운로드

---

## 현재 상태

### 주요 통계

| 지표 | 값 | 상태 |
|------|-----|------|
| **코드 라인 수** | 4,252 | ✅ 최적화 완료 (-15.6%) |
| **테스트** | 92/92 통과 (100%) | ✅ 모두 통과 |
| **TypeScript 오류** | 0 | ✅ 타입 안전 |
| **빌드** | 성공 | ✅ 프로덕션 준비 |
| **번들 크기** | 최적화됨 | ✅ 코드 분할 |

### 기능 완성도

**Phase 1-6 (모두 완료):**
- ✅ 프로젝트 설정 (Next.js 16, TypeScript, Turbopack)
- ✅ 핵심 기능 (업로드, 플레이어, 타임라인, 트리밍, 다운로드)
- ✅ 편의 기능 (키보드 단축키, 미리보기, 프레임 단위 탐색)
- ✅ 고급 기능 (파형, 줌, 잠금, 가장자리 미리보기)
- ✅ 흐름 완성 (재설정, 오류 재시도)
- ✅ 테스팅 (92개 유닛 테스트, Playwright 프레임워크)

**Phase 이후 개선 (2026-01-28 ~ 2026-02-11):**
- ✅ MP4Box 마이그레이션 (10-20배 속도 향상)
- ✅ FFmpeg 정확도 개선 (±0.5초 → ±0.02초)
- ✅ 하이브리드 디스패처 (자동 방법 선택)
- ✅ 6단계 리팩토링 (787줄 감소, -15.6%)
- ✅ URL 영상 편집 (yt-dlp + streamlink)
- ✅ Streamlink 자동 다운로드 (postinstall)

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
| **Vitest** | 유닛 테스팅 (92개) |
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
  export: { trimmedUrl, filename }
}
```

**Selector 패턴** (`src/stores/selectors.ts`):
- `useTimelineState()` - 타임라인 데이터
- `useTimelineActions()` - 타임라인 액션
- `usePlayerState()` - 플레이어 상태
- `usePhase()` - 현재 phase
- `useVideoSource()` - 비디오 소스 타입
- `useShallow` 사용으로 불필요한 리렌더링 방지

### 2. 기능별 구조

```
src/features/
├── upload/          # 파일 업로드, 드래그 앤 드롭
│   ├── components/  UploadZone, UploadProgress
│   ├── hooks/       useFileUpload
│   └── utils/       validateFile
│
├── url-input/       # URL 입력 (2026-02-08)
│   ├── components/  UrlInputZone
│   └── hooks/       useUrlInput
│
├── player/          # Video.js 플레이어
│   ├── components/  VideoPlayerView
│   └── context/     VideoPlayerContext
│
├── timeline/        # 타임라인 에디터 (리팩토링 완료)
│   ├── components/
│   │   ├── TimelineEditor.tsx       (64줄, 오케스트레이터)
│   │   ├── TrimHandle.tsx           (통합 In/Out 핸들)
│   │   ├── Playhead.tsx             (메모이제이션)
│   │   ├── TimelineControls.tsx
│   │   ├── PreviewButtons.tsx
│   │   └── WaveformBackground.tsx
│   ├── hooks/
│   │   ├── useDragHandle.ts
│   │   ├── useKeyboardShortcuts.ts
│   │   ├── usePreviewPlayback.ts
│   │   └── useTimelineZoom.ts
│   └── utils/
│       ├── timeFormatter.ts
│       └── constrainPosition.ts
│
└── export/          # 내보내기 및 트리밍
    ├── components/
    │   ├── ExportButton.tsx
    │   ├── ExportProgress.tsx       (지연 로딩)
    │   ├── DownloadButton.tsx       (지연 로딩)
    │   └── ErrorDisplay.tsx
    └── utils/
        ├── trimVideoDispatcher.ts   (지능적 선택)
        ├── trimVideoMP4Box.ts       (로컬 파일 - 주요)
        ├── trimVideoFFmpeg.ts       (로컬 파일 - 대체)
        └── trimVideoServer.ts       (URL 영상)
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
   - 파일명: {원본}_edited.{확장자}
   - URL.revokeObjectURL() 정리
   - 재설정 버튼으로 idle 복귀
```

#### URL 영상 편집 (2026-02-08)

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

3. 트리밍 (editing → processing → completed)
   - POST /api/video/trim (서버 사이드)
   - 2단계 프로세스:
     Stage 1: streamlink --stream-segmented-duration → temp file
     Stage 2: ffmpeg -i temp -ss <reset> -c copy → final
   - 스트림 응답 (Range 지원)
   - 브라우저에서 다운로드

4. 의존성 관리
   - yt-dlp: system > .bin/yt-dlp > yt-dlp-wrap
   - streamlink: bundled > system (postinstall 자동 다운로드)
   - ffmpeg: @ffmpeg-installer/ffmpeg (v4.4 번들)
```

### 4. 플레이어-타임라인 동기화

**경쟁 조건 방지 패턴**:

```typescript
// 문제: 드래그 중 비디오 timeupdate 이벤트가 currentTime 덮어씀

// 해결: isScrubbing 플래그
interface PlayerState {
  isScrubbing: boolean;  // 핵심 플래그
  isSeeking: boolean;
}

// Playhead 드래그
const handleDragStart = () => {
  setIsScrubbing(true);  // 비디오 업데이트 비활성화
};
const handleDragEnd = () => {
  setIsScrubbing(false);  // 비디오 업데이트 재활성화
};

// Video.js timeupdate
player.on('timeupdate', () => {
  if (isScrubbing || player.seeking()) {
    return;  // 사용자 상호작용 중 무시
  }
  setCurrentTime(player.currentTime());  // 안전한 업데이트
});
```

**동기화 흐름**:
- 일반 재생: 비디오 → 스토어 → 타임라인 ✓
- 드래그 중: 타임라인 → 스토어 → 비디오, timeupdate 무시 ✓

### 5. 핵심 설계 패턴

#### 통합 컴포넌트 (TrimHandle)

**문제**: InPointHandle + OutPointHandle 85% 중복 (130줄)

**해결**: `type` prop으로 단일 컴포넌트 (85줄)

```typescript
<TrimHandle type="in" />   // In Point
<TrimHandle type="out" />  // Out Point
```

#### 분해 패턴 (TimelineEditor)

**문제**: TimelineEditor 182줄, 8개 책임

**해결**: 관심사 분리
```
TimelineEditor (64줄, 오케스트레이터)
├── usePreviewPlayback() (90줄)
├── useTimelineZoom() (30줄)
├── TimelineControls (73줄)
└── PreviewButtons (26줄)
```

#### 메모이제이션 (Playhead)

```typescript
export const Playhead = memo(function Playhead() {
  const position = useMemo(() => {
    if (draggingPosition !== null) return draggingPosition;
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  }, [draggingPosition, currentTime, duration]);

  return <div style={{ left: `${position}%` }} />;
});
```

**효과**: 재생 중 리렌더링 ~50% 감소

#### 디바운싱 (파형 줌)

```typescript
useEffect(() => {
  const debounceTimer = setTimeout(() => {
    wavesurferRef.current.zoom(zoom * 10);
  }, 100);  // 마지막 변경 후 100ms 대기

  return () => clearTimeout(debounceTimer);
}, [zoom]);
```

**효과**: 부드러운 Ctrl+휠 스크롤

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

#### Video.js 플레이어 폐기

```typescript
useEffect(() => {
  const playerInstance = videojs(videoRef.current, options);

  return () => {
    if (playerInstance) {
      playerInstance.dispose();  // 언마운트 시 정리
    }
  };
}, []);
```

#### Wavesurfer 파괴

```typescript
useEffect(() => {
  const ws = WaveSurfer.create({ /* ... */ });

  return () => {
    if (ws) {
      ws.destroy();  // 언마운트 또는 비디오 변경 시
    }
  };
}, [videoUrl]);
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

export interface ErrorDetails {
  code: VideoTrimError;
  message: string;          // 사용자 친화적
  suggestion?: string;      // 복구 방법
  technical?: string;       // 개발자용
  recoverable: boolean;
}
```

**ErrorDisplay 컴포넌트**:
- 사용자 친화적 메시지
- 실행 가능한 제안
- 복구 옵션 (재시도, 재설정)
- 기술 세부사항 (접을 수 있음)

### 8. 의존성 관리

**자동 다운로드** (`scripts/setup-deps.mjs`):

```javascript
// postinstall 훅에서 실행
async function setupDependencies() {
  await setupYtdlp();      // .bin/yt-dlp 다운로드
  await setupStreamlink(); // .bin/streamlink-* 다운로드
}
```

**경로 해석** (`src/lib/binPaths.ts`):

```typescript
// 우선순위: system > bundled > yt-dlp-wrap
export function getYtdlpPath(): string {
  if (hasCommand('yt-dlp')) return 'yt-dlp';           // system
  if (existsSync('.bin/yt-dlp')) return '.bin/yt-dlp'; // bundled
  return require('yt-dlp-wrap').default.ytDlpPath;     // npm
}

// 우선순위: bundled > system
export function getStreamlinkPath(): string | null {
  const bundled = `.bin/streamlink-${platform}-${arch}`;
  if (existsSync(bundled)) return bundled;             // bundled
  if (hasCommand('streamlink')) return 'streamlink';   // system
  return null;
}

// ffmpeg: 번들 우선
export function getFfmpegPath(): string {
  return require('@ffmpeg-installer/ffmpeg').path;     // bundled v4.4
}
```

**플랫폼별 전략**:
- **Windows**: streamlink portable .zip → `adm-zip` 압축 해제
- **Linux**: streamlink AppImage (x64/ARM64) → `--appimage-extract-and-run`
- **macOS**: streamlink 시스템 설치 필요 (`brew install streamlink`)

**Git 최적화**:
```gitignore
/.bin  # 자동 다운로드, Git 추적 안 함
```

**효과**:
- Git 저장소: 10MB 유지 (470MB 증가 방지)
- 사용자: `npm install` 시 자동 설정
- 배포: Vercel, Docker 등에서 자동 동작

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
npm test              # Vitest 유닛 테스트 (92개)
npm run test:ui       # Vitest UI
npm run test:coverage # 커버리지 리포트
npm run test:e2e      # Playwright E2E (대부분 스킵)
npm run test:e2e:ui   # Playwright UI
```

### Git 커밋 규칙

**언어**: 한국어 (Korean)

**형식**:
```
<type>: <subject in Korean>

<body in Korean - optional>
```

**타입**:
- `feat`: 새 기능
- `fix`: 버그 수정
- `refactor`: 리팩토링
- `docs`: 문서 변경
- `test`: 테스트 추가/수정
- `chore`: 기타 변경

**예시**:
```
feat: URL 영상 편집 기능 추가

yt-dlp와 streamlink를 사용하여 YouTube, 치지직 등 URL 영상 편집 지원
- /api/video/resolve로 메타데이터 추출
- /api/video/trim으로 서버 트리밍
```

**중요**: AI authorship mentions 포함 금지 (Co-Authored-By 등)

### 코드 품질 체크

커밋 전:
1. ✅ `npm test` - 모든 테스트 통과
2. ✅ `npm run type-check` - TypeScript 오류 없음
3. ✅ `npm run lint` - 린팅 오류 없음
4. ✅ 수동 테스팅 - 주요 워크플로 확인

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
| Streamlink | ±1초 (세그먼트) | URL 영상, HLS |

### 메모리 사용

- **권장**: < 500MB
- **경고**: 500MB - 1GB
- **위험**: 1GB - 3GB
- **차단**: > 3GB

메모리 모니터링으로 브라우저 크래시 전 경고.

### 번들 크기

- 코드 분할 최적화
- 초기 로드: 최소화
- MP4Box: ~500KB
- FFmpeg.wasm: 필요 시 지연 로딩
- Export 컴포넌트: lazy loading

---

## 제약사항 및 한계

### 기술적 제약

1. **키프레임 정확도 (MP4Box)**:
   - ±1-2초 정확도 (키프레임 기반)
   - 짧은 클립은 FFmpeg로 자동 전환

2. **브라우저 메모리**:
   - 큰 파일 (>1GB) 속도 저하 가능
   - 3GB 하드 제한

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

**입력**:
- **MP4** ✅ (최고 성능)
- **WebM** ✅
- **OGG** ✅
- **QuickTime (MOV)** ✅
- **AVI** ✅
- **MKV** ✅

**출력**: 입력 형식 유지

---

## 배포

### 환경 변수

```bash
# .env.local (선택적)
NEXT_PUBLIC_MAX_FILE_SIZE=3221225472  # 3GB (기본값)
```

### Vercel 배포

```bash
# 자동 배포
git push origin main

# 수동 배포
vercel --prod
```

**postinstall 자동 실행**:
- yt-dlp 다운로드 → `.bin/yt-dlp`
- streamlink 다운로드 → `.bin/streamlink-linux-x64`
- Vercel 빌드 시 자동 처리

### Docker 배포

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci  # postinstall 자동 실행

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

**FUSE 없는 환경**:
- AppImage 자동 감지
- `--appimage-extract-and-run` 플래그 추가

### 배포 체크리스트

- ✅ `npm run build` 성공
- ✅ `npm test` 통과
- ✅ `npm run type-check` 오류 없음
- ✅ 환경 변수 설정
- ✅ COEP 정책 확인 (`credentialless`)
- ✅ 의존성 자동 다운로드 확인

---

## 문서 구조

```
.docs/
├── PROJECT.md         # 이 문서 (현재 상태)
├── HISTORY.md         # 개발 히스토리
└── archive/
    └── project-specification.md  # 초기 설계 (참고용)
```

**루트 레벨**:
- `README.md` - 프로젝트 개요, 설치, 사용법
- `CLAUDE.md` - Claude Code 가이드
- `TESTING.md` - 테스팅 가이드라인

---

## 결론

Video Trimmer는 다음을 갖춘 **성숙한 프로덕션 준비 애플리케이션**입니다:

- ✅ 모든 계획된 기능 구현 완료
- ✅ 포괄적인 테스팅 (92개, 100% 통과)
- ✅ 최적화된 코드베이스 (-15.6%)
- ✅ 우수한 성능 (하이브리드 트리밍)
- ✅ 강력한 오류 처리
- ✅ 깔끔한 아키텍처
- ✅ 자동 의존성 관리
- ✅ 완전한 문서

**프로젝트는 프로덕션 배포 준비가 완료되었습니다.**

---

**문서 버전**: 1.0
**마지막 업데이트**: 2026-02-11
**다음 검토**: 주요 기능 추가 후
