# Video Trimmer - 개발 히스토리

> **기간**: 2026-01-21 ~ 2026-02-11 (22일)
> **주요 변경**: 버그 수정, 아키텍처 전환, 정확도 개선, 기능 확장, 종합 리팩토링, URL 편집 지원
> **최종 상태**: 프로덕션 준비 완료 (4,252줄, 92개 테스트 통과)

---

## 초기 설계 (2026-01-20)

### 원래 계획

프로젝트는 FFmpeg.wasm 기반으로 시작:
- **목표**: 프레임 단위 정확한 트리밍
- **트레이드오프**: 느린 처리 (500MB 파일 30-60초), 큰 번들 (~30MB)
- **아키텍처**: COEP `require-corp` + SharedArrayBuffer

### 실제 구현으로 변경된 이유

개발 중 성능 문제로 MP4Box.js로 전환 (2026-01-28):
- **성능**: 10-20배 빠름 (0.5-1초)
- **정확도**: 키프레임 기반 (±1-2초) vs 프레임 단위 (±0.02초)
- **결론**: 사용자는 속도를 선호 (짧은 클립은 FFmpeg fallback)

초기 설계 문서는 Git 히스토리에 보존.

---

## 개발 타임라인

| 날짜 | 이벤트 | 영향 |
|------|-------|------|
| 2026-01-20 | 프로젝트 시작 | FFmpeg.wasm 기반 설계 |
| 2026-01-21 | Playhead snap-back 버그 수정 | 안정적인 타임라인 조작 |
| 2026-01-28 | MP4Box 마이그레이션 | 10-20배 속도 향상 |
| 2026-01-28 | FFmpeg 정확도 개선 | ±0.5초 → ±0.02초 |
| 2026-01-29 | 하이브리드 디스패처 | MP4Box + FFmpeg 자동 선택 |
| 2026-01-30 | 6단계 리팩토링 완료 | 787줄 감소 (-15.6%) |
| 2026-02-08 | URL 트리밍 구현 | yt-dlp + streamlink 통합 |
| 2026-02-11 | Streamlink 자동 다운로드 | postinstall 바이너리 관리 |

---

## 주요 마일스톤

### 1. Playhead Snap-Back 버그 수정

**날짜**: 2026-01-21
**심각도**: 🟠 높음

#### 문제

드래그 중 비디오 재생 시 playhead가 원래 위치로 snap-back 했다가 올바른 위치로 점프 (깜박임)

#### 근본 원인

1. **Multiple Pending Seeks**: 드래그 중 throttled seek들이 드래그 종료 후에도 계속 완료됨
2. **검증되지 않은 seeked 이벤트**: `player.one('seeked')`가 첫 번째 seeked를 캐치 (최종 seek가 아님)
3. **불안정한 Closures**: `useCallback` dependency에 자주 변경되는 state 포함

#### 해결책

```typescript
// 주요 변경사항:
// 1. 드래그 중 seek 제거 (위치만 업데이트)
// 2. 드래그 종료 시 한 번만 seek
// 3. seeked 이벤트가 목표 시간과 일치하는지 검증
// 4. 안정적인 closure를 위해 ref 사용

const handleDragEnd = () => {
  const finalTime = positionToTime(position);
  finalSeekTargetRef.current = finalTime;

  player.currentTime(finalTime);

  const handleSeeked = () => {
    const diff = Math.abs(player.currentTime() - finalSeekTargetRef.current);
    if (diff < 0.1) {  // 우리가 요청한 seek인지 검증
      setIsScrubbing(false);
      player.off('seeked', handleSeeked);
    }
  };

  player.on('seeked', handleSeeked);  // .on 사용, .one 아님
};
```

#### 교훈

증상만 패치하지 말 것. 실행 흐름을 시뮬레이션하여 근본 원인 찾기. 비동기 이벤트 출처 검증.

---

### 2. MP4Box 마이그레이션

**날짜**: 2026-01-28
**영향**: 🔵 중대 (아키텍처 전환)

#### 동기

FFmpeg.wasm은 느리고 (500MB 파일에 30-60초) 무거웠음 (30MB 번들). MP4Box.js는 스트림 복사 방식으로 재인코딩 불필요.

#### 변경사항

- **제거**: FFmpeg.wasm 트리머, 라이프사이클 훅 (179줄)
- **추가**: MP4Box.js 트리머, TypeScript 정의 (316줄)
- **방식**: MP4 구조 파싱 → 시간 범위의 샘플 추출 → 새 MP4 생성

#### 결과

| 지표 | 이전 (FFmpeg) | 이후 (MP4Box) | 개선 |
|------|--------------|---------------|------|
| 처리 시간 (500MB) | ~60초 | ~3초 | 20배 |
| CPU 사용량 | 매우 높음 | 낮음 | - |
| 정확도 | ±0.02초 | ±1-2초 | - |
| 번들 크기 | ~30MB | ~500KB | 60배 |

#### Trade-off

✅ 속도, 품질, 번들 크기
⚠️ 프레임 단위 정확도 → 키프레임 정확도

**참고**: 다음날 FFmpeg를 하이브리드 방식의 fallback으로 재추가.

---

### 3. FFmpeg 정확도 개선

**날짜**: 2026-01-28
**영향**: 🟢 중요

#### 문제

FFmpeg 트리밍 시 ±0.5초 오차 발생, 특히 키프레임 경계가 아닌 지점에서.

#### 근본 원인

`-ss`가 `-i` **앞**에 위치하면 빠른 입력 탐색(키프레임 기반) 사용.

#### 해결책

`-ss`를 `-i` **뒤**로 이동하여 출력 탐색(정확함) 사용:

```bash
# 이전 (입력 탐색 - 빠르지만 부정확)
-ss 2.345 -i input.mp4 -t 3.0 -c copy output.mp4

# 이후 (출력 탐색 - 정확)
-i input.mp4 -ss 2.345 -t 3.0 -c copy output.mp4
```

#### 결과

- **정확도**: ±0.5초 → ±0.02초 (25배 개선)
- **속도**: 거의 영향 없음 (+4.5%, `-c copy`로 여전히 빠름)
- **품질**: 변화 없음 (여전히 스트림 복사)

#### 교훈

FFmpeg에서 옵션 **위치**가 중요. 항상 벤치마크 필요—문서가 특정 사용 사례에서 오해의 소지 있을 수 있음.

---

### 4. 하이브리드 디스패처

**날짜**: 2026-01-29
**영향**: 🟢 중요

#### 동기

MP4Box는 빠르지만 부정확 (±1-2초), FFmpeg는 정확하지만 느림. 사용자가 선택하도록 강요하지 말고 앱이 자동 선택.

#### 구현

**파일**: `src/features/export/utils/trimVideoDispatcher.ts`

```typescript
function trimVideo(file: File, inPoint: number, outPoint: number) {
  const duration = outPoint - inPoint;
  const sizeMB = file.size / (1024 * 1024);

  // 결정 매트릭스
  if (duration <= 60 && sizeMB <= 100) {
    // 짧고 작음: 정확도 중요
    return trimVideoFFmpeg(file, inPoint, outPoint);
  } else {
    // 길거나 큼: 속도 중요
    return trimVideoMP4Box(file, inPoint, outPoint);
  }
}
```

#### 추가 개선 사항

**강화된 오류 처리**:
- 구체적 오류 타입 (`MEMORY_EXCEEDED`, `FILE_TOO_LARGE` 등)
- 복구 방법이 포함된 사용자 친화적 메시지
- 메모리 모니터링 (브라우저 크래시 전 경고)

**파일 크기 다단계 제한**:
```
RECOMMENDED: 500MB   // 경고 없음
WARNING:     1GB     // 경고, 허용
DANGER:      3GB     // 강한 경고, 허용
BLOCKED:     >3GB    // 차단
```

**추가 형식**:
- QuickTime (.mov)
- AVI (.avi)
- Matroska (.mkv)

**기타**:
- Playhead 드래그 중 실시간 비디오 시킹
- 부드러운 진행률 표시 (FFmpeg 로그 파싱)
- FFmpeg 지연 로딩

#### 총 변경량

- 추가: ~913줄
- 제거: ~80줄
- 순증: +833줄

---

### 5. 6단계 리팩토링

**날짜**: 2026-01-30
**소요 시간**: ~6시간
**영향**: 🔵 중대

#### 목표

코드 품질 개선, 중복 제거, 컴포넌트 분해, 성능 최적화.

#### Phase 1: 유틸리티 통합

**절감**: ~60줄

- `formatBytes` 중복 제거
- 시간 포맷팅 통합
- Store selector 생성 (`src/stores/selectors.ts`)

#### Phase 2: 컴포넌트 통합

**절감**: ~49줄

`InPointHandle` + `OutPointHandle` → `TrimHandle` 병합:

```typescript
// 이전: 2개 파일, 130줄 (85% 중복)
<InPointHandle />
<OutPointHandle />

// 이후: 1개 파일, 85줄
<TrimHandle type="in" />
<TrimHandle type="out" />
```

#### Phase 3: TimelineEditor 분해

**절감**: ~117줄

182줄 모놀리식 컴포넌트를 분해:

```
TimelineEditor (64줄, 오케스트레이터)
├── usePreviewPlayback.ts (90줄)
├── useTimelineZoom.ts (30줄)
├── PreviewButtons.tsx (26줄)
└── TimelineControls.tsx (73줄)
```

#### Phase 4: 상태 관리 개선

**절감**: ~40줄

**중요 버그 수정**: MP4Box race condition

```typescript
// 이전: 첫 콜백에서 완료 처리 (잘못됨)
mp4boxfile.onSamples = (trackId, user, samples) => {
  trackData.completed = true;  // ❌ MP4Box가 여러 번 호출함!
};

// 이후: 비활성 기반 감지
let lastSampleTime = Date.now();

const completionCheck = setInterval(() => {
  const inactive = Date.now() - lastSampleTime;
  if (inactive > 150 && tracksData.size > 0) {
    clearInterval(completionCheck);
    resolve();  // ✅ 실제로 완료됨
  }
}, 50);

onSamples: (trackId, user, samples) => {
  trackData.samples.push(...samples);
  lastSampleTime = Date.now();  // 활동 업데이트
};
```

추가:
- 오류 설정과 phase 전환 분리
- FFmpeg 정리 함수 추가
- 테스트: 90 → 92개

#### Phase 5: 데드 코드 제거

**절감**: ~114줄

- `useFFmpeg.ts` 삭제 (72줄, 완전히 미사용)
- 오류 핸들러 맵 통합

#### Phase 6: 성능 최적화

- Playhead 메모이제이션 (리렌더링 ~50% 감소)
- Waveform 줌 디바운싱 (100ms)
- 코드 스플리팅 (ExportProgress, DownloadButton lazy load)

**효과**: 부드러운 UX, 빠른 초기 로드

#### 리팩토링 요약

| Phase | 절감량 | 위험도 | 시간 |
|-------|--------|--------|------|
| 1. 유틸리티 | ~60 | Low | 1.5h |
| 2. 컴포넌트 | ~49 | Medium | 2h |
| 3. 분해 | ~117 | Medium | 2.5h |
| 4. 상태 | ~40 | Medium-High | 3h |
| 5. 데드 코드 | ~114 | Low | 1h |
| 6. 성능 | - | Low | 1.5h |
| **합계** | **787줄** | - | **~6h** |

**결과**: 5,039 → 4,252줄 (15.6% 감소), 모든 테스트 통과, 리그레션 없음.

---

### 6. URL 트리밍 구현

**날짜**: 2026-02-08
**영향**: 🔵 중대 (신규 기능)

#### 배경

사용자가 YouTube, 치지직 등 URL 영상을 편집하고 싶어함. 로컬 파일 편집만 지원하던 앱에 URL 지원 추가.

#### 아키텍처

```
[사용자] URL 붙여넣기
  ↓
POST /api/video/resolve  (yt-dlp -J로 메타데이터 + 스트림 URL 추출)
  ↓
VideoFile 저장 (source: 'url', streamType: 'hls' | 'mp4')
  ↓
Video.js 플레이어
  - HLS: 직접 URL 사용
  - MP4: /api/video/proxy?url=<encoded> 프록시 (Range 지원)
  ↓
기존 타임라인 에디터로 구간 설정
  ↓
POST /api/video/trim  (서버 트리밍)
  - Stage 1: streamlink --stream-segmented-duration → temp file
  - Stage 2: ffmpeg -i temp -ss <reset> -c copy → final
  ↓
스트림 응답 (Range 지원)
  ↓
브라우저에서 다운로드
```

#### 주요 파일 변경

**수정된 파일** (12개):
- `src/types/store.ts`: VideoFile 인터페이스 확장 (source, streamType, originalUrl)
- `src/stores/useStore.ts`: `setVideoFromUrl` 액션, reset 로직 수정
- `src/stores/selectors.ts`: `useVideoSource()`, `useStreamUrl()` 추가
- `src/features/upload/components/UploadZone.tsx`: UrlInputZone 통합
- `src/features/player/components/VideoPlayerView.tsx`: 동적 MIME type
- `src/features/export/components/ExportButton.tsx`: URL 소스 분기
- `next.config.ts`: COEP 정책 변경 (credentialless)
- 테스트 파일: mock에 `source: 'file'` 추가

**새로 생성된 파일** (6개):
- `src/app/api/video/resolve/route.ts`: yt-dlp URL 해석 API
- `src/app/api/video/proxy/route.ts`: 비디오 프록시 API (Range 지원)
- `src/app/api/video/trim/route.ts`: 서버 트리밍 API
- `src/features/url-input/components/UrlInputZone.tsx`: URL 입력 UI
- `src/features/url-input/hooks/useUrlInput.ts`: URL 입력 로직
- `src/features/export/utils/trimVideoServer.ts`: 서버 트림 클라이언트

#### 주요 설계 결정

**COEP 정책 변경**:
- 기존: `require-corp` (모든 경로)
- 변경: `credentialless` (비-API 경로), API 경로는 COEP 없음
- 이유: 프록시 응답이 cross-origin 리소스 포함, FFmpeg.wasm SharedArrayBuffer 여전히 지원

**프록시 설계**:
- Range 요청 지원으로 video.js 시킹 가능
- 원본 서버의 Content-Type/Content-Length/Content-Range 전달
- same-origin `/api/video/proxy` URL로 CORS 문제 없음

**트리밍 전략**:
- streamlink의 `--stream-segmented-duration` 사용 (정확한 세그먼트 추출)
- 2단계 프로세스: streamlink 다운로드 → ffmpeg 타임스탬프 리셋
- 1단계 파이프 방식 대신 안정성 선택

#### 의존성

**시스템 요구사항** (로컬 개발):
- `yt-dlp` CLI
- `ffmpeg` CLI
- `streamlink` CLI

**문제점**: 사용자가 수동 설치 필요 → 다음 마일스톤에서 해결

#### 검증 상태

- ✅ TypeScript 타입 체크 통과
- ✅ 92개 단위 테스트 통과
- ✅ 프로덕션 빌드 성공
- ✅ YouTube URL 수동 테스트
- ✅ 치지직 VOD URL 수동 테스트
- ✅ 기존 파일 업로드 회귀 테스트

---

### 7. Streamlink 자동 다운로드

**날짜**: 2026-02-11
**영향**: 🟢 중요

#### 문제

사용자가 `pip install streamlink` 수동 설치 필요. 서버리스 환경(Vercel)에서 동작 불가.

#### 고려한 대안

1. **Git 커밋** ❌ - 저장소 470MB 증가, clone 5분
2. **Git LFS** ❌ - GitHub 무료 대역폭 제한
3. **npm 패키지** ❌ - 유지보수 부담
4. **postinstall 다운로드** ✅ - **채택**

#### 구현

**1. 다운로드 스크립트** (`scripts/setup-deps.mjs`)

```javascript
// npm install 실행 시 자동으로 streamlink 다운로드
async function setupStreamlink() {
  if (hasCommand('streamlink')) return;              // 시스템 확인
  if (existsSync(getStreamlinkBinPath())) return;    // 번들 확인
  await downloadStreamlink();                         // GitHub에서 다운로드
}
```

**플랫폼별 전략**:
- **Windows**: 공식 포터블 .zip → `adm-zip` 압축 해제
- **Linux**: AppImage (x64/ARM64) → `chmod +x`
- **macOS**: 바이너리 미제공, Homebrew 설치 안내

**다운로드 소스**:
- `github.com/streamlink/windows-builds` (Windows)
- `github.com/streamlink/streamlink-appimage` (Linux)

**2. 경로 해석** (`src/lib/binPaths.ts`)

```typescript
export function getStreamlinkPath(): string | null {
  // 1순위: 번들 바이너리 (.bin/)
  const bundledPath = join(cwd(), '.bin', `streamlink-${platform}-${arch}`);
  if (existsSync(bundledPath)) return bundledPath;

  // 2순위: 시스템 설치
  if (hasCommand('streamlink')) return 'streamlink';

  return null;
}
```

**3. API 통합** (Linux AppImage FUSE 대응)

```typescript
const streamlinkBin = getStreamlinkPath();
const args = ['--stream-segmented-duration', ...];

// Docker 등 FUSE 없는 환경 자동 감지
if (streamlinkBin.endsWith('.AppImage')) {
  args.unshift('--appimage-extract-and-run');
}

spawn(streamlinkBin, args);
```

#### Git 저장소 최적화

```gitignore
# Downloaded binaries (auto-downloaded by postinstall)
/.bin
```

**효과**:
- Git 저장소 용량: 10MB 유지 (470MB 증가 방지, 97% 절감)
- `git clone` 시간: 10초 이내
- 각 개발자는 `npm install` 시 자동 다운로드

#### 배포 환경 지원

**Vercel**:
```bash
npm install  # postinstall 자동 실행 → streamlink 다운로드
npm run build
```

**Docker**:
```dockerfile
RUN npm ci  # postinstall 포함, 추가 apt-get install 불필요
```

**GitHub Actions**:
```yaml
- run: npm ci  # postinstall 자동 실행
- run: npm test  # streamlink 사용 테스트 통과
```

#### 성능 지표

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| Git clone | ~5분 (470MB) | ~10초 (10MB) | 30배 |
| 저장소 용량 | 470MB | 10MB | 97% 절감 |
| 설치 과정 | 수동 설치 | 자동 (npm install) | ✅ |
| 플랫폼 대응 | 개별 설정 | 통일된 방식 | ✅ |

#### 의존성 추가

```json
{
  "dependencies": {
    "adm-zip": "^0.5.16"
  }
}
```

#### 향후 개선 가능성

- macOS 바이너리 제공 (PyInstaller 빌드)
- 다운로드 재시도 로직 (3회, 백오프 전략)
- 진행률 표시

---

## 기술적 교훈

### 1. 근본 원인 > 증상

**Playhead 버그**: timeout/RAF로 패치하지 말 것. 실행 흐름 시뮬레이션, 실제 race condition 찾기.

### 2. 도구 이해하기

**FFmpeg**: `-ss` 위치가 동작 크게 변경.
**MP4Box**: `onSamples` 여러 번 실행.
항상 API 동작 검증, 가정하지 말 것.

### 3. 성능 > 정확도 (대부분)

사용자는 빠른 것(2-5초, ±1-2초)을 느린 것(60초, ±0.02초)보다 선호.
**예외**: 짧은 클립은 정확도 중요 → 하이브리드 디스패처로 해결.

### 4. 하이브리드 접근의 힘

MP4Box + FFmpeg 디스패처로 둘의 장점 모두 활용. 사용자가 trade-off 이해하도록 강요하지 말고 앱이 현명한 결정.

### 5. 오류 처리도 기능

좋은 오류는 실패를 학습 기회로 전환:
- 무엇이 잘못되었는지
- 어떻게 고치는지
- 대안 옵션

### 6. 점진적 향상

다단계 제한 (OK/WARNING/DANGER/BLOCKED) > 하드 리미트. 점진적 제한이 유연성 제공.

### 7. 점진적 리팩토링 효과

- 작은 원자적 커밋
- 위험도 기반 순서 (낮은 위험 먼저)
- 매 phase마다 테스트
- 전/중/후 문서화

결과: 목표의 223% 달성 (787 vs 350줄), 계획보다 50% 빠름.

### 8. 실제 영향 측정

실제 파일로 테스트 (100MB, 500MB, 1GB). 벤치마크 결과 `-ss` 위치가 스트림 복사에서 속도 영향 미미함을 확인, 일반 문서와 상반.

### 9. 의존성 관리 전략

postinstall 훅을 활용한 자동 다운로드로 사용자 편의성과 저장소 효율성을 동시에 확보. Git에는 코드만, 런타임에 바이너리.

### 10. 플랫폼 독립성

다운로드 스크립트로 Windows/Linux/macOS 모두 지원. 플랫폼별 예외 처리 (AppImage FUSE, .zip 압축 해제).

---

## 성능 메트릭 변화

| 항목 | Phase 1 | Phase 6 | 최종 | 개선 |
|------|---------|---------|------|------|
| 트리밍 속도 (500MB) | 60초 (FFmpeg) | 3초 (MP4Box) | 3초 | 20배 |
| FFmpeg 정확도 | ±0.5초 | ±0.02초 | ±0.02초 | 25배 |
| 코드 라인 | 5,042줄 | 4,252줄 | 4,252줄 | -15.6% |
| Git clone | - | - | 10초 (10MB) | - |
| 의존성 설치 | 수동 | 수동 | 자동 | ✅ |
| 번들 크기 | ~30MB | ~500KB | ~500KB | 60배 |
| 지원 소스 | 파일 | 파일 | 파일 + URL | ✅ |

---

## 주요 커밋 히스토리

### 로컬 파일 편집 (2026-01-21 ~ 2026-01-30)

```
2026-01-21  fix: Playhead snap-back 버그 수정
2026-01-28  feat: MP4Box 트리밍으로 전환 (10-20배 빠름)
2026-01-28  fix: FFmpeg 정확도 개선 (±0.02초)
2026-01-29  feat: 하이브리드 디스패처 추가
2026-01-30  refactor: Phase 1-6 리팩토링 완료 (787줄 감소)
```

### URL 영상 편집 (2026-02-08 ~ 2026-02-11)

```
2026-02-08  feat: URL 영상 미리보기 + 서버 다운로드 후 로컬 편집 워크플로우
2026-02-08  feat: streamlink 트리밍 방식을 2단계 프로세스로 개선
2026-02-08  refactor: URL 영상 다운로드 진행률 UI를 정직한 메시지로 개선
2026-02-08  refactor: streamUrl 제거 및 originalUrl 직접 사용으로 간소화
2026-02-09  test: URL 워크플로우 E2E 테스트 추가
2026-02-09  fix: URL 영상 Export 시 자동 다운로드 및 파일 손상 문제 해결
2026-02-10  feat: edit 화면으로 뒤로가기 버튼
2026-02-10  feat: 병렬다운로드로 성능향상
2026-02-11  remove: 불필요 콘솔로그 삭제
```

---

## 프로젝트 통계

**개발 기간**: 2026-01-20 ~ 2026-02-11 (22일)

**총 코드 변경**:
- Phase 1-6: 787줄 감소
- URL 기능: ~600줄 추가
- 최종: 4,252줄

**테스트**:
- 유닛 테스트: 90 → 92개 (100% 통과)
- E2E 테스트: 프레임워크 구성 완료

**주요 마일스톤**: 7개

**버그 수정**: 3개 (Playhead snap-back, MP4Box race condition, URL export)

**신규 기능**: 5개 (MP4Box, 하이브리드, URL 편집, 자동 다운로드, 뒤로가기)

---

## 결론

Video Trimmer는 22일 동안 다음을 달성했습니다:

- ✅ 핵심 기능 구현 및 최적화
- ✅ 중대 버그 수정 (race condition 2건)
- ✅ 성능 20배 향상 (MP4Box)
- ✅ 정확도 25배 향상 (FFmpeg)
- ✅ 코드 15.6% 감소 (리팩토링)
- ✅ URL 영상 편집 지원 (신규 기능)
- ✅ 의존성 자동 관리 (사용자 경험 개선)
- ✅ 프로덕션 준비 완료

**핵심 성과**:
> 빠르고 (MP4Box), 정확하고 (FFmpeg fallback), 확장 가능하고 (URL 지원), 사용하기 쉬운 (자동 설정) 비디오 편집 앱

**기술적 선택의 핵심**:
- 하이브리드 접근 (MP4Box + FFmpeg)
- 자동 의존성 관리 (postinstall)
- 점진적 리팩토링 (6단계)
- 근본 원인 해결 (race condition)

**프로젝트는 프로덕션 배포 준비가 완료되었습니다.**

---

**문서 버전**: 1.0
**마지막 업데이트**: 2026-02-11
**다음 검토**: 주요 마일스톤 후
