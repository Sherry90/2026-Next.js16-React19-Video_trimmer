# Video Trimmer - 개발 히스토리

> **기간**: 2026-01-21 ~ 현재
> **주요 변경**: 버그 수정, 아키텍처 전환, 정확도 개선, 기능 확장, 종합 리팩토링 (3회), URL 편집 지원, SSE 마이그레이션, YouTube 지원, 성능 분석 및 최적화
> **최종 상태**: 자체 포함 배포 완성 (149개 테스트 통과, CDN 미의존, 전 플랫폼 자동 설치)

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
| 2026-02-12 | 11단계 리팩토링 완료 | 코드 간소화 및 중복 제거 |
| 2026-02-14 | SSE 마이그레이션 | Socket.IO 제거, 번들 100KB 감소 |
| 2026-02-15 | YouTube 지원 추가 | Strategy Pattern, yt-dlp 통합 |
| 2026-02-16 | 성능 분석 및 문서 정리 | YouTube 병목 조사, CLAUDE.md 간소화 |
| 2026-02-17 | YouTube 1-phase 최적화 | 30-32초 (~15% 단축), race condition 수정 |
| 2026-02-19 | DownloadProgressTracker 공통화 | 다운로더 간 중복 제거, selectors 세분화 |
| 2026-02-22~25 | UI 폴리싱 | URL 검증 애니메이션, 파일명 트림 구간 반영 |
| 2026-02-26 | 자체 포함 배포 완성 | FFmpeg.wasm CDN 제거, macOS Streamlink 자동 설치 |

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
DANGER:      2GB     // 강한 경고, 허용
BLOCKED:     >5GB    // 차단
```

**추가 형식**:
- QuickTime (.mov)
- AVI (.avi)
- Matroska (.mkv)

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

#### Phase 5: 데드 코드 제거

**절감**: ~114줄

- `useFFmpeg.ts` 삭제 (72줄, 완전히 미사용)
- 오류 핸들러 맵 통합

#### Phase 6: 성능 최적화

- Playhead 메모이제이션 (리렌더링 ~50% 감소)
- Waveform 줌 디바운싱 (100ms)
- 코드 스플리팅 (ExportProgress, DownloadButton lazy load)

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
POST /api/video/trim  (서버 트리밍 - Chzzk용 레거시)
  - Stage 1: streamlink --hls-duration → temp file
  - Stage 2: ffmpeg -c copy -avoid_negative_ts make_zero → final
  ↓
스트림 응답 (Range 지원)
  ↓
브라우저에서 다운로드
```

#### 주요 설계 결정

**COEP 정책 변경**:
- 기존: `require-corp` (모든 경로)
- 변경: `credentialless` (비-API 경로), API 경로는 COEP 없음
- 이유: 프록시 응답이 cross-origin 리소스 포함, FFmpeg.wasm SharedArrayBuffer 여전히 지원

**프록시 설계**:
- Range 요청 지원으로 video.js 시킹 가능
- same-origin `/api/video/proxy` URL로 CORS 문제 없음

---

### 7. Streamlink 자동 다운로드

**날짜**: 2026-02-11
**영향**: 🟢 중요

#### 문제

사용자가 `pip install streamlink` 수동 설치 필요. 서버리스 환경(Vercel)에서 동작 불가.

#### 구현

**postinstall 자동 다운로드** (`scripts/setup-deps.mjs`):

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

#### 성능 지표

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| Git clone | ~5분 (470MB) | ~10초 (10MB) | 30배 |
| 저장소 용량 | 470MB | 10MB | 97% 절감 |
| 설치 과정 | 수동 설치 | 자동 (npm install) | ✅ |

---

### 8. 코드 간소화 리팩토링

**날짜**: 2026-02-12
**소요 시간**: ~14시간 (9일 기준)
**영향**: 🔵 중대 (코드 품질 개선)

#### 11단계 리팩토링 요약

**새로 생성된 파일** (11개):
```
src/lib/
├── processUtils.ts          # 프로세스 관리 (타임아웃, 종료)
├── apiErrorHandler.ts       # API 에러 처리 표준화
└── formatSelector.ts        # yt-dlp 형식 선택

src/features/timeline/hooks/
└── usePlayheadSeek.ts       # Playhead seek 검증

src/features/export/utils/
├── mp4boxHelpers.ts         # MP4Box 샘플 필터링
└── FFmpegSingleton.ts       # FFmpeg 인스턴스 관리

src/features/export/hooks/
└── useExportState.ts        # Export 버튼 상태 관리

src/features/url-input/components/
├── UrlPreviewCard.tsx       # 썸네일 및 비디오 정보
└── UrlPreviewRangeControl.tsx # 시작/종료 시간 입력

src/features/url-input/hooks/
└── useUrlDownload.ts        # URL 다운로드 로직

src/stores/
└── selectorFactory.ts       # Selector 생성기
```

**주요 도입 패턴**:
1. 프로세스 유틸리티 (runWithTimeout)
2. FFmpeg 클래스 기반 Singleton
3. Selector Factory 패턴

**결과**: 92개 테스트 통과, TypeScript 타입 체크 통과, 프로덕션 빌드 성공.

---

### 9. SSE 마이그레이션 및 리팩토링

**날짜**: 2026-02-14
**영향**: 번들 크기 감소, 타입 안전성 강화, 코드 간소화

#### 배경

Socket.IO를 사용한 URL 다운로드 진행 상황 전송:
- 양방향 통신 불필요 (서버 → 클라이언트만 필요)
- 큰 번들 크기 (socket.io + socket.io-client ~100KB, 21개 의존성)

#### 해결 방법

**Server-Sent Events 도입**:
```typescript
// Before: Socket.IO
io.on('connection', (socket) => { ... });
socket.emit('progress', data);

// After: SSE
controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
```

**API 구조**:
- `POST /api/download/start` → jobId 반환
- `GET /api/download/stream/[jobId]` → SSE 스트림
- `GET /api/download/[jobId]` → 완료된 파일 다운로드

**EventSource onerror 해결**:
```typescript
// complete 이벤트 수신 즉시 클라이언트가 먼저 닫기
eventSource.close();
eventSourceRef.current = null;
// → 이후 onerror 발생 방지
```

**클라이언트 가중치 계산** (`src/features/url-input/utils/sseProgressUtils.ts`):
```typescript
const PHASE_WEIGHTS = {
  DOWNLOADING: 0.9,  // 0-90%
  PROCESSING: 0.1,   // 90-100%
};
```

#### 결과

- 번들 크기: **-100KB** (Socket.IO 제거)
- 의존성: **-21 packages**
- 타입 안전성: Discriminated Union (`src/types/sse.ts`)

#### 교훈

1. 양방향 통신이 필요 없으면 SSE가 Socket.IO보다 적합
2. EventSource 정상 종료: 클라이언트가 서버보다 먼저 종료해야 onerror 방지
3. SSE listener는 Map 객체의 속성 직접 변경으로 관리 — `jobs.set(id, {...job})`으로 재생성하면 listener 배열 참조가 끊겨 이벤트 전송 실패 (race condition)

---

### 10. YouTube 지원 추가

**날짜**: 2026-02-15
**영향**: 플랫폼 확장, Strategy Pattern 도입, 테스트 커버리지 증가

#### Strategy Pattern 도입

```typescript
// src/lib/platformDetector.ts
detectPlatform(url: string): 'chzzk' | 'youtube' | 'generic'
selectDownloadStrategy(platform, streamType): 'streamlink' | 'ytdlp'
```

**플랫폼별 다운로더**:
1. **Chzzk** (`src/lib/streamlinkDownloader.ts`): 2-phase (Streamlink + FFmpeg)
2. **YouTube** (`src/lib/ytdlpDownloader.ts`): 초기에는 2-phase (마일스톤 12에서 1-phase로 최적화)
3. **Generic**: yt-dlp (YouTube와 동일)

**테스트 증가**: 119개 → 143개 (+24개)

---

### 11. 성능 분석 및 문서 정리

**날짜**: 2026-02-16
**영향**: 성능 이해도 향상, 문서 간소화

#### YouTube 속도 분해

```
총 36초 = 네트워크 다운로드 + FFmpeg 구간 추출
- 네트워크: 전체 다운로드 시 93 Mbps로 빠름 (측정됨)
- 병목: --download-sections의 내부 FFmpeg 처리
- -N 증가나 aria2c 최적화는 효과 미미
```

**결론**: 36초는 `--download-sections` 사용의 현실적 한계. 긴 영상에서 효율적.

---

### 12. YouTube 1-phase 최적화 및 파일 완성 검증

**날짜**: 2026-02-17
**영향**: YouTube 다운로드 ~15% 속도 향상, duration NaN 버그 수정

#### YouTube 1-phase 최적화

**Before** (2-phase):
- Phase 1: `yt-dlp --download-sections "*START-END"` → temp file
- Phase 2: `ffmpeg -avoid_negative_ts make_zero -c copy` → final file
- 총 시간: ~36초

**After** (1-phase):
- Phase 1 only: `yt-dlp --download-sections --postprocessor-args "ffmpeg:..."` → final file
- `--postprocessor-args "ffmpeg:-avoid_negative_ts make_zero -fflags +genpts -movflags +faststart"`로 FFmpeg 처리를 yt-dlp 내부에 통합
- 총 시간: **~30-32초** (Phase 2 제거로 4-6초 단축)

**Trade-off**: 코드 단순화 + I/O 감소 (파일 2회 → 1회 처리)

#### ensureFileComplete() — OS 버퍼 플러시 대기

**문제**: 프로세스 종료 직후 파일이 아직 OS 커널 버퍼에 있어 불완전한 상태로 전달됨

**증상**: 클라이언트에서 video.js `duration = NaN` → Playhead가 0%에 고정

**해결** (`src/lib/streamUtils.ts`):
```typescript
async function ensureFileComplete(filePath: string): Promise<void> {
  // 1. OS 버퍼 플러시 대기 (10-100ms)
  await waitForStableFileSize(filePath);

  // 2. MP4 ftyp 헤더 검증 (bytes 4-8)
  const header = await readBytes(filePath, 4, 8);
  if (!isValidFtypHeader(header)) {
    throw new Error('Invalid MP4 file: ftyp header not found');
  }
}
```

**적용**: Streamlink + yt-dlp 양쪽 다운로더에 적용

**교훈**: `Process exit ≠ file write complete`. OS 커널 버퍼 플러시는 프로세스 종료 후 10-100ms 더 걸릴 수 있음.

---

### 13. DownloadProgressTracker 공통화 및 Selector 세분화

**날짜**: 2026-02-19
**영향**: 다운로더 간 중복 제거, 스토어 추적성 향상

#### DownloadProgressTracker

두 다운로더(`streamlinkDownloader.ts`, `ytdlpDownloader.ts`)의 공통 진행률 관리 로직을 추출:

**파일**: `src/lib/downloadTypes.ts`

```typescript
class DownloadProgressTracker {
  emitProgress(progress: number, phase: string): void
  updateProgress(value: number): void
  resetForPhase(phase: string): void
  emitComplete(filename: string): void  // 상태 업데이트 미포함
  emitError(message: string): void      // 상태 업데이트 미포함
}
```

**설계 원칙**: tracker는 이벤트 발송만 담당. `updateJobStatus()`는 호출자(다운로더)가 직접 호출.

#### Selector 세분화

`src/stores/selectors.ts`에 download 전용 selector 추가:
- `useDownloadPhase` — 현재 다운로드 phase
- `useDownloadMessage` — 진행 메시지
- `useActiveDownloadJobId` — 활성 Job ID
- `useZoom`, `usePlayhead` — 세분화된 타임라인 selector

#### 기타 변경

- **`setDownloadPhase`** 리네임 (구 `setDownloadStage`): store 필드명 `downloadPhase`와 일관성
- **`DOWNLOAD` 상수 섹션**: `src/constants/appConfig.ts`에 추가
  - `STREAMLINK_SEGMENT_THREADS`, `YTDLP_CONCURRENT_FRAGMENTS`, `ARIA2C_*`, `MIN_VALID_FILE_SIZE`
- 유닛 테스트: 143개 → 149개 (+6개)

---

### 14. UI 폴리싱 — URL 검증 애니메이션 & 파일명 트림 구간 반영

**날짜**: 2026-02-22~25
**영향**: 사용자 경험 향상, 파일명 정보 증가

#### URL 입력 유효성 검증 애니메이션

URL 입력 필드에 유효성 검증 상태(대기/성공/오류)를 시각적 애니메이션으로 표시.

#### 내보내기 파일명에 트림 구간 반영

**Before**: `{원본파일명}_edited.{확장자}`

**After**: `{원본파일명}(MMmSSs-MMmSSs).{확장자}`

예시: `video(02m30s-05m10s).mp4`

**이유**: 같은 영상을 여러 구간으로 내보낼 때 파일명이 충돌하지 않도록 트림 구간을 포함.

**구현**: `src/features/export/utils/generateFilename.ts`의 `generateTrimFilename()` 함수.

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

### 7. 적절한 도구 선택

SSE > Socket.IO (단방향 스트리밍에서). 적절한 도구 선택이 번들 크기와 복잡도를 동시에 줄임.

### 8. Process exit ≠ file write complete

OS 커널 버퍼 플러시는 프로세스 종료 후 10-100ms 추가 소요. 파일 완성 검증 없이 상태를 `completed`로 바꾸면 클라이언트에 불완전한 파일이 전달될 수 있음.

### 9. 의존성 관리 전략

postinstall 훅을 활용한 자동 다운로드로 사용자 편의성과 저장소 효율성을 동시에 확보. Git에는 코드만, 런타임에 바이너리.

### 10. 플랫폼 독립성

다운로드 스크립트로 Windows/Linux/macOS 모두 지원. 플랫폼별 예외 처리 (AppImage FUSE, .zip 압축 해제).

### 11. 불필요한 기능 제거의 가치

기능을 추가하는 것만큼 제거하는 것도 중요. Preview Full 제거로 23줄 감소 + UI 단순화 + 사용자 혼란 감소.

### 12. 점진적 리팩토링의 재확인

여러 차례 대규모 리팩토링 모두 동일한 전략:
- 작은 원자적 커밋
- 위험도 기반 순서
- 매 단계 테스트

결과: **제로 리그레션**, 모든 테스트 통과.

### 13. 외부 플랫폼은 표준을 선택적으로 구현한다

표준(RFC, HLS 스펙 등)은 권고이지 강제가 아니다. 각 플랫폼은 자사 인프라 보호,
외부 접근 제어, 구현 편의 등의 이유로 표준을 부분적으로 무시한다.

이 프로젝트에서 발견된 사례:

| 플랫폼 | 표준 동작 기대 | 실제 동작 | 발견 방법 |
|--------|--------------|-----------|----------|
| Chzzk | `--stream-segmented-duration` 으로 구간 제한 | 플래그 무시, 전체 스트림 다운로드 | 직접 실행 후 소거법 |
| YouTube | `-N` 병렬 fragment 다운로드로 속도 향상 | 서버 throttle로 효과 없음 | 속도 실측 비교 |
| Chzzk | HLS 표준 세그먼트 메타데이터 | FFmpeg 8.0 거부 (비표준 .m4v) | 버전별 실행 테스트 |

**핵심**: 외부 클라이언트 개발자는 이를 사전에 알 수 없다. 직접 실행하고 관찰하는
시행착오만이 유일한 방법이며, 이 과정은 어떤 문서나 AI로도 단축할 수 없다.

### 14. 바이브 코딩이 효과적인 영역과 이 프로젝트의 근본적 차이

**바이브 코딩(AI 보조 개발)이 효과적인 조건**:
- 반복 패턴 — CRUD, REST API, UI 컴포넌트 등 유사 사례가 많은 도메인
- 잘 문서화된 표준 라이브러리/프레임워크 (React, Next.js, Tailwind 등)
- AI 학습 데이터에 수천 개의 유사 사례가 존재하는 문제
- 틀린 구현을 타입 체커·린터·테스트가 즉시 잡아주는 영역

**이 프로젝트가 그것과 근본적으로 다른 이유**:

| 구분 | 바이브 코딩 적합 프로젝트 | 이 프로젝트 |
|------|----------------------|-----------|
| 핵심 난이도 | 올바른 패턴 선택 | 올바른 패턴이 플랫폼마다 다름 |
| 문서화 수준 | 공식 문서에 답이 있음 | 공식 문서에 없는 플랫폼 특화 동작 |
| AI 학습 데이터 | 유사 사례 충분 | Chzzk 비표준 HLS, YouTube throttle 등 공개 자료 없음 |
| 에러 특성 | "왜 틀렸는지" 메시지 있음 | "왜 안 되는지"조차 모름 (unknown unknown) |
| 검증 방법 | 단위 테스트로 충분 | 실제 플랫폼에서 직접 실행해야만 확인 가능 |

**구체적 사례 (이 프로젝트)**:
- `--stream-segmented-duration` → Chzzk에서 무시 (어떤 문서에도 없음, item 13)
- `-N 8` 병렬 다운로드 → YouTube 서버 throttle로 효과 없음 (item 13)
- `ffmpeg 8.0` → Chzzk `.m4v` 세그먼트 거부 (버전 변경으로 갑자기 발생)
- 프로세스 종료 후 파일 불완전 → OS 커널 버퍼 플러시 타이밍 (item 8)

**핵심**: AI는 "이미 알려진 것"에서 탁월하다. 이 프로젝트의 핵심 난제들은
직접 실행하기 전까지는 아무도 — 개발자도, AI도 — 모르는 것들이다.
바이브 코딩 도구가 이 영역을 대신해줄 것이라는 기대는 잘못된 자신감으로 이어진다.

---

## 성능 메트릭 변화

| 항목 | Phase 1 | Phase 6 | 최종 | 개선 |
|------|---------|---------|------|------|
| 트리밍 속도 (500MB) | 60초 (FFmpeg) | 3초 (MP4Box) | 3초 | 20배 |
| FFmpeg 정확도 | ±0.5초 | ±0.02초 | ±0.02초 | 25배 |
| Git clone | - | - | 10초 (10MB) | - |
| 의존성 설치 | 수동 | 수동 | 자동 | ✅ |
| 번들 크기 | ~30MB | ~500KB | ~500KB | 60배 |
| 지원 소스 | 파일 | 파일 | 파일 + URL | ✅ |
| YouTube 다운로드 (1분) | - | ~36초 | **~30-32초** | ~15% |

---

**문서 버전**: 2.0
**마지막 업데이트**: 2026-02-25
**다음 검토**: 주요 마일스톤 후
