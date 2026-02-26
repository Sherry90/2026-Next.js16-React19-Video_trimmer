# 외부 의존성 관리

Video Trimmer에서 사용하는 외부 바이너리 의존성과 자동 설치 시스템에 대한 상세 문서입니다.

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
│   ├── 번들: @ffmpeg-installer/ffmpeg v4.4
│   └── 용도: 타임스탬프 리셋, yt-dlp 내부 muxing
├── yt-dlp (필수)
│   ├── 번들: .bin/yt-dlp (auto-download)
│   └── 용도: URL 메타데이터 추출, YouTube/Generic 구간 다운로드
└── Streamlink (필수)
    ├── 번들: .bin/streamlink (auto-download)
    └── 용도: Chzzk HLS 스트림 구간 다운로드
```

### 우선순위 전략

각 바이너리는 다음 우선순위로 탐색됩니다:

| 바이너리 | 우선순위 |
|---------|----------|
| FFmpeg | 번들 (`@ffmpeg-installer`) → 시스템 (`ffmpeg`) |
| yt-dlp | 시스템 (`yt-dlp`) → 번들 (`.bin/yt-dlp`) → npm (`yt-dlp-wrap`) |
| Streamlink | 번들 (`.bin/streamlink`) → 시스템 (`streamlink`) |

### Next.js 빌드 설정

**파일:** `next.config.ts`

```typescript
const nextConfig = {
  serverExternalPackages: [
    '@ffmpeg-installer/ffmpeg',
    'yt-dlp-wrap',
  ],
};
```

**왜 필요한가?**
- `@ffmpeg-installer/ffmpeg`는 dynamic require 사용
- Turbopack이 번들링 시도 → 실패
- external로 지정 → node_modules에서 직접 require

---

## 2. FFmpeg

### 역할

비디오/오디오 처리의 핵심 도구.

**Video Trimmer에서의 용도:**
1. **타임스탬프 리셋** (메인 용도)
   - Streamlink로 다운로드한 HLS 세그먼트의 타임스탬프를 0부터 시작하도록 리셋
   - `-avoid_negative_ts make_zero` 플래그 사용
2. **yt-dlp 내부 의존성**
   - yt-dlp가 muxing (비디오+오디오 병합)에 사용
   - YouTube 1-phase 다운로드에서 postprocessor로 FFmpeg 호출
3. **브라우저 내 처리** (FFmpeg.wasm, fallback용)
   - 짧은 클립(≤60초) + 작은 파일(≤100MB)에서 자동 선택
   - `trimVideoDispatcher.ts`가 조건에 따라 MP4Box 대신 선택

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

#### YouTube postprocessor 통합 (1-phase)

**파일:** `src/lib/ytdlpDownloader.ts`

```bash
yt-dlp --postprocessor-args \
  "ffmpeg:-avoid_negative_ts make_zero -fflags +genpts -movflags +faststart" \
  --ffmpeg-location /path/to/bundled/ffmpeg \
  <url>
```

yt-dlp가 내부적으로 FFmpeg를 호출하여 muxing + 타임스탬프 리셋을 한 번에 처리.

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
   - `--download-sections`로 지정 구간만 다운로드
3. **포맷 선택**
   - 최고 화질 muxed 포맷 선택

### 번들 방식

**자동 다운로드:**
- **트리거:** `npm postinstall` → `scripts/setup-deps.mjs`
- **다운로드 위치:** `.bin/yt-dlp` (Git 무시됨)
- **소스:** GitHub Releases (yt-dlp-wrap 통해 다운로드)
- **플랫폼:** Linux, macOS, Windows

**Fallback:** `yt-dlp-wrap` npm 패키지
- yt-dlp 바이너리를 npm으로 설치
- 크기 큼 (~100MB)

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
| macOS | - | 시스템만 (`brew install streamlink`) |

**macOS 제한:** 번들 바이너리 미제공. `brew install streamlink` 필수.

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
class StreamlinkProgressParser {
  parseLine(line: string): number | null {
    // "Segment 42 complete" 파싱
    // 세그먼트 개수 기반 진행률 계산
  }
}
```

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

```typescript
export function getYtdlpPath(): string {
  try {
    // 1. 시스템 yt-dlp
    execSync('which yt-dlp', { stdio: 'ignore' });
    return 'yt-dlp';
  } catch {
    // 2. 번들 yt-dlp (.bin/)
    const bundledPath = path.join(process.cwd(), '.bin', 'yt-dlp');
    if (existsSync(bundledPath)) {
      return bundledPath;
    }
    // 3. npm yt-dlp-wrap
    return 'yt-dlp'; // yt-dlp-wrap이 PATH에 추가
  }
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
    bundledPath = join(projectRoot, '.bin', 'streamlink-macos');
    // macOS: setup-deps.mjs가 번들을 제공하지 않으므로 항상 miss
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
│    - .bin/yt-dlp 확인                │
│    - 없으면 yt-dlp-wrap로 다운로드   │
└─────────────────────────────────────┘
  ↓
┌─────────────────────────────────────┐
│ 3. setupStreamlink()                │
│    - 시스템 streamlink 확인          │
│    - .bin/streamlink-* 확인          │
│    - 없으면 플랫폼별 다운로드        │
└─────────────────────────────────────┘
  ↓
의존성 설치 완료
```

**출력 예시:**
```
Video Trimmer - Dependencies

  ffmpeg: v4.4.1 (bundled)
  yt-dlp: v2024.12.06 (system)
  streamlink: 8.2.0 (system)
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
  console.warn('    macOS: Please install streamlink via Homebrew:');
  console.warn('    brew install streamlink');
  throw new Error('macOS binary not available');
}
```

**이유:** Homebrew가 macOS 표준 패키지 관리자. 바이너리 배포보다 시스템 통합이 안정적.

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
- yt-dlp: `.bin/yt-dlp`
- Streamlink: `.bin/streamlink-linux-x64.AppImage` (또는 arm64)

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
- FFmpeg: 번들
- yt-dlp: `.bin/yt-dlp`

**수동 설치 필수:**
```bash
brew install streamlink
```

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
- yt-dlp: `.bin/yt-dlp.exe`
- Streamlink: `.bin/streamlink-win/streamlink.exe` (portable)

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
```bash
brew install streamlink
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
- [yt-dlp-wrap](https://www.npmjs.com/package/yt-dlp-wrap)
