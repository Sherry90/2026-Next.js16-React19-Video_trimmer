# 외부 의존성 관리

이 앱은 영상을 다루려고 **외부 프로그램 4개**를 빌려 쓴다: `ffmpeg`(영상 자르기·변환), `yt-dlp`(온라인 영상 정보·다운로드), `streamlink`(치지직 같은 라이브 구간 받기), `aria2c`(빠른 병렬 다운로드). 사용자가 이걸 직접 설치할 필요는 없다 — `npm install` 할 때 설치 스크립트(`scripts/setup-deps.mjs`)가 알아서 받아 `.bin/`에 넣어 준다.

이 문서는 그 프로그램들이 **어떻게 준비되고, 어디서 찾아지고, 문제가 생기면 어떻게 고치는지**를 설명한다.

## 목차

1. [개요](#1-개요)
2. [FFmpeg](#2-ffmpeg)
3. [yt-dlp](#3-yt-dlp)
4. [Streamlink](#4-streamlink)
5. [바이너리 경로 관리 (binPaths.ts)](#5-바이너리-경로-관리-binpathsts)
6. [setup-deps.mjs](#6-setup-depsmjs)
7. [플랫폼별 설치 가이드](#7-플랫폼별-설치-가이드)
8. [문제 해결 및 테스트 검증](#8-문제-해결-및-테스트-검증)

---

## 1. 개요

### 의존성 맵

```
Video Trimmer
├── FFmpeg (필수)
│   ├── 번들: @ffmpeg-installer/ffmpeg v4.4 (서버)
│   └── 용도: 타임스탬프 리셋, yt-dlp 내부 muxing
├── FFmpeg.wasm (브라우저 fallback)
│   ├── 번들: @ffmpeg/core v0.12.6 → public/ffmpeg/ (자체 호스팅)
│   └── 용도: 비-MP4 파일 브라우저 내 트리밍
├── yt-dlp (필수)
│   ├── 번들: 번들 Python venv(.bin/yt-dlp-venv)에 pip 설치 (onefile은 fallback)
│   └── 용도: URL 메타데이터 추출, YouTube/Generic 구간 다운로드
├── Streamlink (필수)
│   ├── 번들: .bin/streamlink (auto-download)
│   └── 용도: Chzzk HLS 스트림 구간 다운로드
└── aria2c (다운로드 가속)
    ├── 번들: .bin/aria2/aria2c (플랫폼 prebuilt auto-download)
    └── 용도: YouTube 전체 다운로드 폴백 시 다중연결 병렬 수신(스로틀 우회)
```

### 우선순위 전략

각 바이너리는 다음 우선순위로 탐색됩니다:

| 바이너리 | 우선순위 |
|---------|----------|
| FFmpeg | 번들 (`@ffmpeg-installer`) → 시스템 (`ffmpeg`) |
| yt-dlp | venv (`.bin/yt-dlp-venv`) → 시스템 (`yt-dlp`) → 번들 onefile (`.bin/yt-dlp`) |
| Streamlink | 번들 (`.bin/streamlink*`) → 시스템 (`streamlink`) |
| aria2c | 번들 (`.bin/aria2/aria2c`) → 시스템 (`aria2c`) → `null`(미설치, 폴백 시 aria2c 없이 진행) |

### Next.js 빌드 설정

**파일:** `next.config.ts`

```typescript
const nextConfig = {
  serverExternalPackages: ['@ffmpeg-installer/ffmpeg'],
};
```

**왜 필요한가?**
- `@ffmpeg-installer/ffmpeg`는 dynamic require 사용
- 번들러가 번들링 시도 → 실패
- external로 지정 → node_modules에서 직접 require

---

## 2. FFmpeg

### 역할

비디오/오디오 처리의 핵심 도구.

**Video Trimmer에서의 용도:**
1. **타임스탬프 리셋** (메인 용도)
   - Streamlink로 다운로드한 HLS 세그먼트의 타임스탬프를 0부터 시작하도록 리셋
   - `-avoid_negative_ts make_zero` 플래그 사용
2. **yt-dlp 내부 의존성 + 로컬 구간 컷**
   - yt-dlp가 muxing (비디오+오디오 병합)에 사용 (`--ffmpeg-location`으로 번들 ffmpeg 지정)
   - YouTube 다운로드 후, 받은 파일을 로컬 ffmpeg로 잘라내고 타임스탬프를 리셋(스트림 카피)
3. **브라우저 내 처리** (FFmpeg.wasm, 비-ISO 형식용)
   - `trimVideoDispatcher.ts`가 형식에 따라 선택: ISO(mp4/mov/m4v)는 MP4Box, 그 외는 FFmpeg.wasm
   - **자체 호스팅**: `@ffmpeg/core` npm 패키지에서 `public/ffmpeg/`로 복사 (CDN 미사용)
   - 비-ISO 파일 내보내기 시점에만 런타임 로드

### 번들 버전

**패키지:** `@ffmpeg-installer/ffmpeg@1.1.0`
- **FFmpeg 버전:** 4.4.0
- **설치 방식:** npm dependency
- **경로:** `node_modules/@ffmpeg-installer/<platform>/ffmpeg`

**플랫폼별 바이너리:**
- Linux: `ffmpeg-4.4-linux-x64`
- macOS: `ffmpeg-4.4-darwin-x64`
- Windows: `ffmpeg-4.4-win32-x64.exe`

### 주요 사용 사례

#### 타임스탬프 리셋 (Chzzk Phase 2)

**파일:** `src/lib/streamlinkDownloader.ts`

```bash
ffmpeg -y -i input.mp4 \
  -c copy \                      # 재인코딩 없음 (빠름)
  -avoid_negative_ts make_zero \ # 타임스탬프 0부터 시작
  -fflags +genpts \               # PTS 재생성
  -movflags +faststart \          # 스트리밍 최적화
  -progress pipe:2 \              # 진행률 출력
  -nostats \                      # 통계 비활성화
  output.mp4
```

**왜 필요한가?**
- Streamlink가 다운로드한 HLS 세그먼트는 원본 타임스탬프 유지
- 예: 10초~30초 구간 다운로드 → 타임스탬프가 10초부터 시작
- 비디오 플레이어가 0초부터 시작하도록 리셋 필요

#### YouTube 전체 다운로드 후 로컬 컷

**파일:** `src/lib/ytdlpDownloader.ts` (`buildFfmpegCutArgs`)

`--download-sections`(yt-dlp 내부 구간 추출)는 쓰지 않는다. 대신 선택 포맷을 받은 뒤,
로컬에서 ffmpeg로 구간을 잘라내며 타임스탬프를 리셋한다(재인코딩 없는 스트림 카피).

```bash
# 구간 컷: -ss를 -i 앞에 둬서 키프레임까지 빠르게 seek (±1-2초)
ffmpeg -y -ss <start> -i full.mp4 -t <duration> \
  -c copy \                      # 재인코딩 없음
  -avoid_negative_ts make_zero \ # 타임스탬프 0부터 시작
  -fflags +genpts \              # PTS 재생성
  -movflags +faststart \         # 스트리밍 최적화
  clip.mp4
```

> byte-range 경로(`byteRangeDownloader.ts`)가 성공하면 이 전체-다운로드 단계 없이,
> 받은 구간 바이트를 바로 ffmpeg로 mux+cut 한다. 자세한 다운로드 전략은
> [01_OVERVIEW.md](./01_OVERVIEW.md#url-영상-통째로-안-받고-필요한-부분만) 참조.

#### FFmpeg 진행률 파싱

**파일:** `src/lib/progressParser.ts`

```typescript
class FFmpegProgressTracker {
  pushChunk(chunk: Buffer | string): number {
    // FFmpeg -progress 출력 파싱
    // out_time_ms=12345678 → 진행 시간 추출
    // progress=end → 완료
  }
}
```

### 알려진 문제

#### Chzzk HLS .m4v 세그먼트 거부 (FFmpeg 8.0)

**문제:**
```bash
ffmpeg 8.0 -i chzzk_segment.m4v
# Error: moov atom not found
```

**원인:** Chzzk의 .m4v 세그먼트가 표준을 벗어남

**해결:**
- FFmpeg 4.4 사용 (번들) ✅
- Streamlink로 다운로드 후 FFmpeg로 타임스탬프만 리셋
- ffmpeg 8.0을 사용하는 어떤 플래그로도 수정 불가

---

## 3. yt-dlp

### 역할

YouTube, Twitch 등 다양한 플랫폼에서 비디오 정보와 스트리밍 URL을 추출합니다.

**Video Trimmer에서의 용도:**
1. **메타데이터 추출** (`/api/video/resolve`)
   - 제목, 길이, 썸네일, 스트림 URL
2. **YouTube/Generic 구간 다운로드** (`/api/download/start`)
   - `--download-sections`는 쓰지 않는다(yt-dlp의 ffmpeg 직렬 구간 추출이 스로틀에 묶임).
     byte-range(`sidx` 파싱으로 구간 바이트만) 우선, 폴백으로 aria2c 다중연결 전체 다운로드 + 로컬 ffmpeg 컷.
3. **포맷 선택**
   - DASH 다중화질(avc1+mp4a) 또는 최고 화질 muxed 포맷 선택

### 번들 방식

**자동 설치(우선):**
- **트리거:** `npm postinstall` → `scripts/setup-deps.mjs`
- **방식:** 프로젝트 번들 Python(.bin/python, 고정 CPython)으로 venv 생성 후 `pip install yt-dlp`
  (`.bin/yt-dlp-venv`, Git 무시됨). 시스템 Python 미사용 → 환경 간 버전 통일.
- **버전:** unpinned(최신) — yt-dlp는 YouTube 변경으로 자주 깨지므로 (Dockerfile과 동일 정책)
- **이유:** 모듈 실행이라 startup ~0.1초 (onefile 바이너리는 매 호출 self-extract로 macOS ~9초)

**Fallback:** 시스템 `yt-dlp` → GitHub Releases 고정 버전 onefile 바이너리(`.bin/yt-dlp`).

### 포맷 선택 로직

**파일:** `src/lib/formatSelector.ts`

```typescript
export function selectBestFormat(ytdlpInfo: YtdlpInfo): FormatSelection | null {
  // 1. Muxed 포맷 필터링 (비디오+오디오)
  const muxedFormats = ytdlpInfo.formats.filter(
    f => f.vcodec !== 'none' && f.acodec !== 'none'
  );

  // 2. 우선순위: HLS (m3u8) > HTTPS > 기타
  const hlsFormats = muxedFormats.filter(
    f => f.protocol === 'm3u8' || f.protocol === 'm3u8_native'
  ).sort((a, b) => (b.tbr || 0) - (a.tbr || 0));

  const httpsFormats = muxedFormats.filter(
    f => f.protocol === 'https'
  ).sort((a, b) => (b.tbr || 0) - (a.tbr || 0));

  if (hlsFormats.length > 0) return hlsFormats[0];
  if (httpsFormats.length > 0) return httpsFormats[0];
  return null;
}
```

**다운로드 포맷 선택** (`buildYtdlpFormatSpec`):
```typescript
// 최고 화질, 제한 없음, flexible fallback
"-f", "bestvideo[height<=?9999]+bestaudio/best"
```

### 지원 플랫폼

yt-dlp는 1000+ 사이트를 지원합니다:
- YouTube, Twitch, Vimeo, Twitter/X
- Naver TV, Afreeca TV
- Chzzk (Streamlink 권장, yt-dlp도 가능)

**전체 목록:** `yt-dlp --list-extractors`

---

## 4. Streamlink

### 역할

라이브 스트리밍 플랫폼에서 HLS/DASH 스트림을 다운로드합니다.

**Video Trimmer에서의 용도:**
1. **Chzzk HLS 스트림 구간 다운로드**
   - `--hls-start-offset`, `--hls-duration`으로 특정 구간만 다운로드
2. **세그먼트 병합**
   - 다수의 HLS 세그먼트를 하나의 MP4로 병합

### 번들 방식

**자동 다운로드:**
- **트리거:** `npm postinstall` → `scripts/setup-deps.mjs`
- **다운로드 위치:** `.bin/streamlink` (Git 무시됨)

**플랫폼별 바이너리:**

| 플랫폼 | 파일 | 소스 |
|--------|------|------|
| Windows | streamlink.exe | streamlink/windows-builds (portable .zip) |
| Linux x64 | streamlink-linux-x64.AppImage | streamlink/streamlink-appimage |
| Linux ARM64 | streamlink-linux-arm64.AppImage | streamlink/streamlink-appimage |
| macOS | .bin/streamlink-venv/bin/streamlink | 번들 Python venv (`pip install streamlink`) |

**macOS 설치 방식:** 공식 portable binary 미제공. 프로젝트 번들 Python(.bin/python, yt-dlp와 동일한 고정 CPython)으로 venv 생성 후 자동 설치 (`npm install` 시). 시스템 Python 불요. 번들 Python 확보 실패 시 graceful fallback (경고만 출력).

### 주요 사용 사례

#### Chzzk HLS 구간 다운로드

```bash
streamlink \
  --loglevel debug \
  --progress=force \                    # 진행률 출력
  --hls-start-offset 00:00:10 \         # 시작 위치
  --hls-duration 00:00:20 \             # 다운로드 길이
  --stream-segment-threads 6 \          # 병렬 다운로드
  "https://chzzk.naver.com/..." best \
  -o output.mp4
```

**`--hls-duration` vs `--stream-segmented-duration`:**
- `--hls-duration`: 실제 비디오 길이 기준 (✅ 사용)
- `--stream-segmented-duration`: 다운로드 시간 제한 (❌ Chzzk에서 무시됨)

#### AppImage 실행 (Linux FUSE 없는 환경)

**파일:** `src/lib/streamlinkDownloader.ts`

```typescript
const args = [...streamlinkArgs];
if (streamlinkBin.endsWith('.AppImage')) {
  args.unshift('--appimage-extract-and-run');
}
```

Docker 등 FUSE가 없는 환경에서 자동 처리됨.

### 진행률 파싱

**파일:** `src/lib/progressParser.ts`

```typescript
class FFmpegProgressTracker {
  pushChunk(chunk: Buffer | string): number {
    // ffmpeg -progress 출력(out_time_ms/out_time/progress=end) 파싱 → 0~100
  }
}

class YtdlpProgressParser {
  parseLine(line: string): number | null {
    // "[download] 45.2% of ..." 파싱 (단조 증가 보장)
  }
}
```

> Streamlink 진행률은 파일 크기 폴링으로 처리(`streamlinkDownloader.ts`)하므로 전용 파서 클래스 없음.

---

## 5. 바이너리 경로 관리 (binPaths.ts)

**파일:** `src/lib/binPaths.ts`

**역할:** 바이너리 경로 결정 및 검증

### getFfmpegPath()

```typescript
export function getFfmpegPath(): string {
  try {
    // 1. 번들 FFmpeg (@ffmpeg-installer)
    return ffmpegInstaller.path;
  } catch {
    // 2. 시스템 FFmpeg
    execSync('which ffmpeg', { stdio: 'ignore' });
    return 'ffmpeg';
  }
}
```

### getYtdlpPath()

우선순위: **venv(pip) > system > 번들 onefile**. onefile은 매 호출 self-extract로 startup 느림
(macOS ~9초), venv/system은 Python 모듈이라 ~0.1초 → venv·system 우선, onefile은 최후 fallback.

```typescript
export function getYtdlpPath(): string {
  // 1. venv-installed yt-dlp (.bin/yt-dlp-venv) — startup 빠름
  const venvBin = /* .bin/yt-dlp-venv/{bin|Scripts}/yt-dlp */;
  if (existsSync(venvBin)) return venvBin;

  // 2. 시스템 yt-dlp (예: Docker pip install) — 역시 모듈이라 빠름
  try { execFileSync('which', ['yt-dlp'], { stdio: 'ignore' }); return 'yt-dlp'; } catch {}

  // 3. 번들 onefile (.bin/yt-dlp) — startup 느림, 최후 fallback
  const bundled = join(process.cwd(), '.bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (existsSync(bundled)) return bundled;

  // 4. 미설치 — 'yt-dlp' 리터럴 반환 → ENOENT로 사용자 에러 유도
  return 'yt-dlp';
}
```

### getStreamlinkPath()

```typescript
export function getStreamlinkPath(): string | null {
  const platform = process.platform;
  const arch = process.arch;

  // 1. 번들 Streamlink (.bin/) — 플랫폼별 경로
  let bundledPath: string | undefined;
  if (platform === 'win32') {
    bundledPath = join(projectRoot, '.bin', 'streamlink-win', 'streamlink.exe');
  } else if (platform === 'linux') {
    const archSuffix = arch === 'arm64' ? 'arm64' : 'x64';
    bundledPath = join(projectRoot, '.bin', `streamlink-linux-${archSuffix}.AppImage`);
  } else if (platform === 'darwin') {
    // Python venv 자동 설치 경로 (postinstall)
    bundledPath = join(projectRoot, '.bin', 'streamlink-venv', 'bin', 'streamlink');
  }

  if (bundledPath && existsSync(bundledPath)) {
    return bundledPath;
  }

  // 2. 시스템 Streamlink
  try {
    execFileSync('which', ['streamlink'], { stdio: 'ignore' });
    return 'streamlink';
  } catch {
    return null; // 미설치 — hasStreamlink()로 가용성 확인
  }
}
```

**반환값:** 경로 문자열 또는 `null` (설치 안 됨). `throw` 없음.
`hasStreamlink()` 래퍼로 가용성 확인 후 사용 권장.

---

## 6. setup-deps.mjs

**파일:** `scripts/setup-deps.mjs`

**실행 시점:**
```json
{
  "scripts": {
    "postinstall": "node scripts/setup-deps.mjs"
  }
}
```

### 실행 흐름

```
npm install
  ↓
postinstall 훅 실행
  ↓
┌─────────────────────────────────────┐
│ 1. checkFfmpeg()                    │
│    - @ffmpeg-installer/ffmpeg 확인  │
│    - 시스템 ffmpeg 확인              │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 2. setupYtDlp()                     │
│    - 시스템 yt-dlp 확인              │
│    - 번들 Python venv에 pip 설치     │
│      (.bin/python = 고정 CPython,    │
│       시스템 Python 미사용)          │
│    - 실패 시 onefile 바이너리 fallback│
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 3. setupStreamlink()                │
│    - 시스템 streamlink 확인          │
│    - .bin/streamlink-* 확인          │
│    - 없으면 플랫폼별 다운로드        │
│      Win/Linux: 공식 바이너리        │
│      macOS: 번들 Python venv(pip)    │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 4. setupAria2c()                    │
│    - 시스템 aria2c 확인 (있으면 사용)│
│    - 없으면 플랫폼 prebuilt 다운로드  │
│      → .bin/aria2/aria2c            │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 5. copyWasmFiles()                  │
│    - @ffmpeg/core → public/ffmpeg/  │
│    - ffmpeg-core.js, .wasm 복사     │
└─────────────────────────────────────┘
  ↓
의존성 설치 완료
```

**출력 예시** (버전 숫자는 예시일 뿐, 실제 값은 플랫폼·시점에 따라 다름):
```
Video Trimmer - Dependencies

  ffmpeg: <version> (bundled)
  yt-dlp: <version> (venv)
  streamlink: <version> (bundled)
```

### 플랫폼별 처리

#### Windows

**바이너리 타입:** Portable `.zip`

```javascript
if (platform === 'win32') {
  const url = `https://github.com/streamlink/windows-builds/releases/download/${version}/streamlink-${version}-py314-x86_64.zip`;
  await downloadAndExtract(url, join(binDir, 'streamlink-win'));
}
```

**압축 해제:** `adm-zip` 패키지 사용
```javascript
async function downloadAndExtract(url, destDir) {
  const AdmZip = (await import('adm-zip')).default;
  const tmpZip = join(binDir, 'temp-streamlink.zip');
  try {
    await downloadFile(url, tmpZip);
    const zip = new AdmZip(tmpZip);
    zip.extractAllTo(destDir, true);
  } finally {
    if (existsSync(tmpZip)) unlinkSync(tmpZip);
  }
}
```

#### Linux

**바이너리 타입:** AppImage

```javascript
else if (platform === 'linux') {
  const archSuffix = arch === 'arm64' ? 'aarch64' : 'x86_64';
  const url = `https://github.com/streamlink/streamlink-appimage/releases/download/${version}/streamlink-...${archSuffix}.AppImage`;
  const destPath = join(binDir, `streamlink-linux-${arch === 'arm64' ? 'arm64' : 'x64'}.AppImage`);
  await downloadFile(url, destPath);
  execFileSync('chmod', ['+x', destPath]);
}
```

**저장 위치:**
- x64: `.bin/streamlink-linux-x64.AppImage`
- ARM64: `.bin/streamlink-linux-arm64.AppImage`

#### macOS

```javascript
else if (platform === 'darwin') {
  // macOS: 프로젝트 번들 Python으로 venv 생성 (yt-dlp와 동일한 고정 CPython → 버전 통일)
  const python = await setupBundledPython();   // .bin/python (없으면 다운로드)
  const venvDir = join(binDir, 'streamlink-venv');
  execFileSync(python, ['-m', 'venv', venvDir], { stdio: 'inherit' });
  execFileSync(join(venvDir, 'bin', 'pip'), ['install', 'streamlink', '--quiet'], { stdio: 'inherit' });
}
```

**저장 위치:** `.bin/streamlink-venv/bin/streamlink`

**이유:** macOS에 공식 portable binary 미제공. 프로젝트 번들 Python(.bin/python)으로 venv 생성 후 pip 설치 → 시스템 Python 불요·버전 통일. 번들 Python 확보 실패 시 catch에서 graceful fallback (경고 출력, npm install은 계속).

### 에러 처리

```javascript
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Video-Trimmer' },
    }, (res) => {
      // 301/302 리다이렉트 자동 따라가기
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const fileStream = createWriteStream(dest);
      pipeline(res, fileStream).then(resolve).catch(reject);
    }).on('error', reject);
  });
}
```

**다운로드 실패 처리:**
```javascript
try {
  await downloadStreamlink();
  console.log('  streamlink: downloaded successfully');
} catch (error) {
  console.warn(`  streamlink: download failed - ${error.message}`);
  console.warn('          HLS trimming will be unavailable');
  console.warn('          Install manually: https://streamlink.github.io/install.html');
}
```

**처리 방침:** 경고만 표시 (치명적 오류 아님). `npm install`이 실패하지 않음.

---

## 7. 플랫폼별 설치 가이드

### Linux

**자동 설치:**
```bash
npm install  # postinstall이 자동 실행
```

**설치되는 것:**
- FFmpeg: 번들 (node_modules)
- yt-dlp: `.bin/yt-dlp-venv` (venv, onefile은 폴백)
- Streamlink: `.bin/streamlink-linux-x64.AppImage` (또는 arm64)
- aria2c: `.bin/aria2/aria2c` (시스템에 있으면 그것 사용)

**시스템 의존성 (선택):**
```bash
# FUSE (AppImage 실행용 - 자동 처리되므로 불필요)
sudo apt-get install fuse libfuse2
```

Docker 등 FUSE 없는 환경: `--appimage-extract-and-run` 자동 사용.

### macOS

**자동 설치:**
```bash
npm install
```

**설치되는 것:**
- FFmpeg: 번들 (`@ffmpeg-installer/ffmpeg`)
- FFmpeg.wasm: `public/ffmpeg/` (자체 호스팅)
- yt-dlp: `.bin/yt-dlp-venv` (번들 Python venv, onefile은 폴백)
- Streamlink: `.bin/streamlink-venv/bin/streamlink` (번들 Python venv)
- aria2c: `.bin/aria2/aria2c` (시스템에 있으면 그것 사용)

**시스템 Python 불요:** 프로젝트가 번들 CPython(`.bin/python`, python-build-standalone)을 받아 venv를 만든다. 번들 Python 확보 실패 시에만 경고 출력 후 계속.
수동 대안: `brew install streamlink`

**확인:**
```bash
npm test -- binPaths.test.ts
```

### Windows

**자동 설치:**
```powershell
npm install
```

**설치되는 것:**
- FFmpeg: 번들
- yt-dlp: `.bin/yt-dlp-venv` (번들 Python venv, `.bin/yt-dlp.exe` onefile은 폴백)
- Streamlink: `.bin/streamlink-win/streamlink.exe` (portable)
- aria2c: `.bin/aria2/aria2c.exe` (시스템에 있으면 그것 사용)

---

## 8. 문제 해결 및 테스트 검증

### FFmpeg 관련

**문제:** `ffmpeg: command not found`

**해결:**
1. 번들 FFmpeg 확인:
   ```bash
   node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)"
   ```
2. 시스템 FFmpeg 설치:
   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu
   sudo apt-get install ffmpeg

   # Windows
   choco install ffmpeg
   ```

**문제:** `moov atom not found`

**해결:** FFmpeg 4.4 사용 (번들). 시스템에 FFmpeg 8.0이 설치되어 있고 번들보다 우선순위가 높은 경우 문제 발생.

### yt-dlp 관련

**문제:** `Unsupported URL`

**해결:**
1. yt-dlp 업데이트:
   ```bash
   yt-dlp -U
   ```
2. 지원 확인:
   ```bash
   yt-dlp --list-extractors | grep -i platform
   ```

**문제:** `ERROR: unable to download video data: HTTP Error 403`

**해결:** yt-dlp 최신 버전 사용 (API 변경 대응)

### Streamlink 관련

**문제:** `Streamlink not found` (macOS)

**해결:**
1. `npm install` 재실행 (Python venv 자동 설치 시도)
2. Python 3 미설치 시:
   ```bash
   brew install streamlink
   ```
3. 또는 수동으로 venv 생성:
   ```bash
   python3 -m venv .bin/streamlink-venv
   .bin/streamlink-venv/bin/pip install streamlink
   ```

**문제:** `AppImage: FUSE not found` (Linux)

**해결:** 자동 처리됨 (`--appimage-extract-and-run` 플래그). 직접 개입 불필요.

**문제:** `No playable streams found`

**해결:**
1. URL 확인
2. 플랫폼 지원 확인:
   ```bash
   streamlink --plugins
   ```

### 테스트로 검증

**파일:** `src/__tests__/unit/binPaths.test.ts`

```bash
npm test -- binPaths.test.ts

# 출력:
# ✓ ffmpeg must be installed and executable
# ✓ yt-dlp must be installed and executable
# ✓ streamlink must be installed and executable (or skipped on macOS)
```

**실패 시 메시지:**
```
❌ FFmpeg not found. Install: brew install ffmpeg
❌ yt-dlp not found. Run: npm run postinstall
❌ Streamlink not found (macOS). Install: brew install streamlink
```

**중요:** 의존성 테스트 실패는 배포 차단 신호. 누락된 의존성은 런타임 오류를 유발.

---

## 참고 자료

- [FFmpeg 공식 문서](https://ffmpeg.org/documentation.html)
- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [Streamlink 문서](https://streamlink.github.io/)
- [@ffmpeg-installer/ffmpeg](https://www.npmjs.com/package/@ffmpeg-installer/ffmpeg)
