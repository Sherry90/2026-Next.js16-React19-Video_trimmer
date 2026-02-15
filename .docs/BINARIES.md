# 바이너리 의존성 상세 문서

Video Trimmer에서 사용하는 모든 바이너리 도구에 대한 상세한 기술 문서입니다.

## 목차

- [개요](#개요)
- [FFmpeg](#ffmpeg)
- [yt-dlp](#yt-dlp)
- [Streamlink](#streamlink)
- [바이너리 관리 시스템](#바이너리-관리-시스템)
- [플랫폼별 설치](#플랫폼별-설치)
- [문제 해결](#문제-해결)

---

## 개요

### 의존성 맵

```
Video Trimmer
├── FFmpeg (필수)
│   ├── 번들: @ffmpeg-installer/ffmpeg v4.4
│   └── 용도: 비디오 처리, 타임스탬프 리셋
├── yt-dlp (필수)
│   ├── 번들: .bin/yt-dlp (auto-download)
│   └── 용도: 스트리밍 URL 추출
└── Streamlink (필수)
    ├── 번들: .bin/streamlink (auto-download)
    └── 용도: HLS 스트림 다운로드
```

### 우선순위 전략

각 바이너리는 다음 우선순위로 탐색됩니다:

| 바이너리 | 우선순위 |
|---------|----------|
| FFmpeg | 번들 (`@ffmpeg-installer`) → 시스템 (`ffmpeg`) |
| yt-dlp | 시스템 (`yt-dlp`) → 번들 (`.bin/yt-dlp`) → npm (`yt-dlp-wrap`) |
| Streamlink | 번들 (`.bin/streamlink`) → 시스템 (`streamlink`) |

---

## FFmpeg

### 역할

비디오/오디오 처리의 핵심 도구.

**Video Trimmer에서의 용도:**
1. **타임스탬프 리셋** (메인 용도)
   - Streamlink로 다운로드한 HLS 세그먼트의 타임스탬프를 0부터 시작하도록 리셋
   - `-avoid_negative_ts make_zero` 플래그 사용
2. **yt-dlp 내부 의존성**
   - yt-dlp가 muxing (비디오+오디오 병합)에 사용
3. **브라우저 내 처리** (FFmpeg.wasm, 현재 미사용)
   - 클라이언트 사이드 대체 옵션

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

#### 1. 타임스탬프 리셋 (서버)

**파일:** `src/lib/downloadJob.ts`, `src/app/api/video/trim/route.ts`

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

#### 2. 진행률 파싱

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

**-progress pipe:2 출력 형식:**
```
frame=120
fps=30.00
stream_0_0_q=0.0
bitrate=2500.0kbits/s
total_size=1048576
out_time_ms=4000000
out_time=00:00:04.000000
dup_frames=0
drop_frames=0
speed=1.0x
progress=continue
```

### 시스템 FFmpeg vs 번들 FFmpeg

**번들 FFmpeg 장점:**
- ✅ 버전 고정 (4.4.0)
- ✅ 플랫폼 간 일관성
- ✅ 설치 불필요

**시스템 FFmpeg 장점:**
- ✅ 최신 버전 가능
- ✅ 더 많은 코덱 지원 (시스템 빌드에 따라)

**우리의 선택:** 번들 우선 (일관성 > 최신 기능)

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

---

## yt-dlp

### 역할

YouTube, Twitch 등 다양한 플랫폼에서 비디오 정보와 스트리밍 URL을 추출합니다.

**Video Trimmer에서의 용도:**
1. **메타데이터 추출**
   - 제목, 길이, 썸네일
2. **스트리밍 URL 추출**
   - HLS (m3u8) 또는 직접 MP4 URL
3. **포맷 선택**
   - 비디오+오디오 muxed 포맷 우선

### 번들 방식

**자동 다운로드:**
- **트리거:** `npm postinstall` → `scripts/setup-deps.mjs`
- **다운로드 위치:** `.bin/yt-dlp` (Git 무시됨)
- **소스:** GitHub Releases (latest)
- **플랫폼:** Linux, macOS, Windows

**Fallback:** `yt-dlp-wrap` npm 패키지
- yt-dlp 바이너리를 npm으로 설치
- 크기 큼 (~100MB)

### 주요 사용 사례

#### 비디오 정보 추출

**파일:** `src/app/api/video/resolve/route.ts`

```bash
yt-dlp -j --no-warnings \
  --ffmpeg-location /path/to/ffmpeg \  # 번들 ffmpeg 사용
  "https://www.youtube.com/watch?v=..."
```

**출력 (JSON):**
```json
{
  "id": "video_id",
  "title": "Video Title",
  "duration": 300,
  "thumbnail": "https://...",
  "formats": [
    {
      "format_id": "22",
      "url": "https://...",
      "vcodec": "avc1.64001F",
      "acodec": "mp4a.40.2",
      "protocol": "https",
      "tbr": 2500
    },
    {
      "format_id": "hls-1080",
      "url": "https://...master.m3u8",
      "vcodec": "avc1.64001F",
      "acodec": "mp4a.40.2",
      "protocol": "m3u8_native",
      "tbr": 5000
    }
  ]
}
```

#### 포맷 선택 로직

**파일:** `src/lib/formatSelector.ts`

```typescript
export function selectBestFormat(ytdlpInfo: YtdlpInfo): FormatSelection | null {
  // 1. Muxed 포맷 필터링 (비디오+오디오)
  const muxedFormats = ytdlpInfo.formats.filter(
    f => f.vcodec !== 'none' && f.acodec !== 'none'
  );

  // 2. 우선순위
  // HLS (m3u8) > HTTPS > 기타
  const hlsFormats = muxedFormats.filter(
    f => f.protocol === 'm3u8' || f.protocol === 'm3u8_native'
  ).sort((a, b) => (b.tbr || 0) - (a.tbr || 0));

  const httpsFormats = muxedFormats.filter(
    f => f.protocol === 'https'
  ).sort((a, b) => (b.tbr || 0) - (a.tbr || 0));

  // 3. 선택
  if (hlsFormats.length > 0) return hlsFormats[0];
  if (httpsFormats.length > 0) return httpsFormats[0];
  return null;
}
```

**왜 HLS를 선호하는가?**
- ✅ 작은 세그먼트 (2-10초)
- ✅ 프록시 스트리밍에 유리
- ✅ 대역폭 적응 가능

### 지원 플랫폼

yt-dlp는 1000+ 사이트를 지원합니다:

**주요:**
- YouTube
- Twitch
- Vimeo
- Twitter/X

**한국:**
- Naver TV
- Afreeca TV
- Chzzk (Streamlink 권장)

**전체 목록:** `yt-dlp --list-extractors`

### 업데이트

```bash
# 시스템 yt-dlp 업데이트
yt-dlp -U

# 번들 yt-dlp 업데이트
npm run postinstall  # setup-deps.mjs 재실행
```

---

## Streamlink

### 역할

라이브 스트리밍 플랫폼에서 HLS/DASH 스트림을 다운로드합니다.

**Video Trimmer에서의 용도:**
1. **HLS 스트림 다운로드**
   - 특정 구간만 다운로드 (`--hls-start-offset`, `--hls-duration`)
2. **세그먼트 병합**
   - 다수의 HLS 세그먼트를 하나의 MP4로 병합
3. **Chzzk 특화**
   - Chzzk HLS는 Streamlink가 더 안정적

### 번들 방식

**자동 다운로드:**
- **트리거:** `npm postinstall` → `scripts/setup-deps.mjs`
- **다운로드 위치:** `.bin/streamlink` (Git 무시됨)

**플랫폼별 바이너리:**

| 플랫폼 | 파일 | 소스 |
|--------|------|------|
| Windows | streamlink.exe | streamlink/windows-builds (portable) |
| Linux x64 | streamlink.AppImage | streamlink/streamlink-appimage |
| Linux ARM64 | streamlink.AppImage | streamlink/streamlink-appimage |
| macOS | - | 시스템만 (brew install streamlink) |

**macOS 제한:**
- 번들 바이너리 제공 안 함
- `brew install streamlink` 필수

### 주요 사용 사례

#### HLS 스트림 다운로드

**파일:** `src/lib/downloadJob.ts`, `src/app/api/video/trim/route.ts`

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

**--hls-duration vs --stream-segmented-duration:**
- `--hls-duration`: 실제 비디오 길이 기준 (✅ 사용)
- `--stream-segmented-duration`: 다운로드 시간 제한 (❌ Chzzk에서 무시됨)

#### 진행률 파싱

**파일:** `src/lib/progressParser.ts`

```typescript
class StreamlinkProgressParser {
  parseLine(line: string): number | null {
    // "Segment 42 complete" 파싱
    // 세그먼트 개수 기반 진행률 계산
  }
}
```

**Streamlink 출력 예시:**
```
[download][info] Opening stream: best (hls)
[download][info] Downloading segment 1 of ∞
Segment 1 complete
[download][info] Downloading segment 2 of ∞
Segment 2 complete
...
[download][info] Stream ended
```

#### AppImage 실행 (Linux)

**문제:** FUSE가 없는 환경 (Docker, 일부 서버)

**해결:**
```bash
streamlink --appimage-extract-and-run <args>
```

**코드:** `src/lib/downloadJob.ts`
```typescript
const args = [...streamlinkArgs];
if (streamlinkBin.endsWith('.AppImage')) {
  args.unshift('--appimage-extract-and-run');
}
```

### 지원 플랫폼

Streamlink는 90+ 플랫폼 지원:

**주요:**
- Twitch
- YouTube Live
- Afreeca TV
- Chzzk

**전체 목록:** `streamlink --plugins`

---

## 바이너리 관리 시스템

### binPaths.ts / binPaths.cjs

**역할:** 바이너리 경로 결정 및 검증

**파일:** `src/lib/binPaths.ts` (ESM), `src/lib/binPaths.cjs` (CommonJS)

**왜 2개 버전인가?**
- ESM: Next.js 서버 컴포넌트
- CommonJS: progressParser.ts (Node.js child_process)

#### getFfmpegPath()

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

#### getYtdlpPath()

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

#### getStreamlinkPath()

```typescript
export function getStreamlinkPath(): string {
  const platform = process.platform;
  let ext = platform === 'win32' ? '.exe' : '.AppImage';
  if (platform === 'darwin') ext = ''; // macOS는 번들 없음

  // 1. 번들 Streamlink (.bin/)
  const bundledPath = path.join(process.cwd(), '.bin', `streamlink${ext}`);
  if (existsSync(bundledPath)) {
    return bundledPath;
  }

  // 2. 시스템 Streamlink
  try {
    execSync('which streamlink', { stdio: 'ignore' });
    return 'streamlink';
  } catch {
    throw new Error('Streamlink not found');
  }
}
```

### setup-deps.mjs

**역할:** postinstall 스크립트로 바이너리 자동 다운로드

**파일:** `scripts/setup-deps.mjs`

**실행 시점:**
```json
{
  "scripts": {
    "postinstall": "node scripts/setup-deps.mjs"
  }
}
```

**로직:**

```javascript
async function downloadYtdlp() {
  const platform = process.platform;
  let url, filename;

  if (platform === 'win32') {
    url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    filename = 'yt-dlp.exe';
  } else {
    url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    filename = 'yt-dlp';
  }

  const outputPath = path.join('.bin', filename);
  await downloadFile(url, outputPath);

  if (platform !== 'win32') {
    fs.chmodSync(outputPath, 0o755); // 실행 권한
  }
}

async function downloadStreamlink() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin') {
    console.log('macOS: use `brew install streamlink`');
    return;
  }

  let url, filename;
  if (platform === 'win32') {
    url = 'https://github.com/streamlink/windows-builds/releases/latest/download/streamlink-portable.zip';
    filename = 'streamlink.exe';
    // ZIP 추출 로직
  } else {
    // Linux
    if (arch === 'arm64') {
      url = 'https://github.com/streamlink/streamlink-appimage/releases/latest/download/streamlink-aarch64.AppImage';
    } else {
      url = 'https://github.com/streamlink/streamlink-appimage/releases/latest/download/streamlink-x86_64.AppImage';
    }
    filename = 'streamlink.AppImage';
  }

  const outputPath = path.join('.bin', filename);
  await downloadFile(url, outputPath);
  fs.chmodSync(outputPath, 0o755);
}
```

---

## 플랫폼별 설치

### Linux

**자동 설치:**
```bash
npm install  # postinstall이 자동 실행
```

**설치되는 것:**
- FFmpeg: 번들 (node_modules)
- yt-dlp: .bin/yt-dlp
- Streamlink: .bin/streamlink.AppImage

**시스템 의존성:**
```bash
# FUSE (AppImage 실행용, 선택)
sudo apt-get install fuse libfuse2

# 또는 --appimage-extract-and-run 사용 (자동)
```

### macOS

**자동 설치:**
```bash
npm install
```

**설치되는 것:**
- FFmpeg: 번들
- yt-dlp: .bin/yt-dlp

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
- yt-dlp: .bin/yt-dlp.exe
- Streamlink: .bin/streamlink.exe (portable)

---

## 문제 해결

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

**해결:** FFmpeg 4.4 사용 (번들), 8.0 사용하지 않기

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

**문제:** `AppImage: FUSE not found`

**해결:** 자동 처리됨 (`--appimage-extract-and-run`)

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

---

## Next.js 빌드 설정

### serverExternalPackages

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

## 참고 자료

- [FFmpeg 공식 문서](https://ffmpeg.org/documentation.html)
- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [Streamlink 문서](https://streamlink.github.io/)
- [@ffmpeg-installer/ffmpeg](https://www.npmjs.com/package/@ffmpeg-installer/ffmpeg)
- [yt-dlp-wrap](https://www.npmjs.com/package/yt-dlp-wrap)
