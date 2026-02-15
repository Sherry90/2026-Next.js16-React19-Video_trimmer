# Scripts Documentation

Video Trimmer 프로젝트의 모든 스크립트에 대한 상세 기술 문서입니다.

## 목차

- [setup-deps.mjs](#setup-depsmjs)
  - [개요](#개요)
  - [실행 흐름](#실행-흐름)
  - [바이너리별 다운로드 전략](#바이너리별-다운로드-전략)
  - [플랫폼별 처리](#플랫폼별-처리)
  - [에러 처리](#에러-처리)
- [cut_video.sh (참조용)](#cut_videosh-참조용)
  - [목적](#목적)
  - [전체 구조](#전체-구조)
  - [핵심 로직](#핵심-로직)
  - [TypeScript 포팅](#typescript-포팅)

---

## setup-deps.mjs

### 개요

**파일**: `scripts/setup-deps.mjs`

**목적**: 프로젝트에 필요한 바이너리 의존성을 자동으로 다운로드합니다.

**실행 시점**: `npm install` 시 postinstall 훅으로 자동 실행

```json
// package.json
{
  "scripts": {
    "postinstall": "node scripts/setup-deps.mjs"
  }
}
```

**관리 대상 바이너리**:
1. **ffmpeg**: `@ffmpeg-installer/ffmpeg` npm 패키지로 번들 (다운로드 불필요)
2. **yt-dlp**: GitHub releases에서 자동 다운로드
3. **streamlink**: 플랫폼별 바이너리 다운로드

**다운로드 위치**: `.bin/` 폴더 (Git-ignored)

---

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

**출력 예시**:
```
Video Trimmer - Dependencies

  ffmpeg: v4.4.1 (bundled)
  yt-dlp: v2024.12.06 (system)
  streamlink: 8.2.0 (system)
```

---

### 바이너리별 다운로드 전략

#### 1. FFmpeg

**전략**: npm 패키지로 번들 (다운로드 불필요)

```javascript
function checkFfmpeg() {
  try {
    const installer = require('@ffmpeg-installer/ffmpeg');
    if (existsSync(installer.path)) {
      console.log(`  ffmpeg: v${installer.version} (bundled)`);
      return;
    }
  } catch {
    // @ffmpeg-installer/ffmpeg 패키지 없음
  }

  if (hasCommand('ffmpeg')) {
    console.log('  ffmpeg: found (system)');
  } else {
    console.warn('  ffmpeg: NOT FOUND - install with: brew install ffmpeg');
  }
}
```

**우선순위**:
1. 번들된 ffmpeg (`@ffmpeg-installer/ffmpeg`)
2. 시스템 ffmpeg (fallback)

**특이사항**: 다운로드 로직 없음 (npm 패키지가 바이너리 포함)

---

#### 2. yt-dlp

**전략**: 시스템 → .bin/ → yt-dlp-wrap 다운로드

```javascript
async function setupYtDlp() {
  // 1. 시스템 yt-dlp 확인
  if (hasCommand('yt-dlp')) {
    try {
      const version = execFileSync('yt-dlp', ['--version'], { encoding: 'utf-8' }).trim();
      console.log(`  yt-dlp: v${version} (system)`);
    } catch {
      console.log('  yt-dlp: found (system)');
    }
    return;
  }

  // 2. .bin/yt-dlp 확인
  const ytdlpBinPath = join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
  if (existsSync(ytdlpBinPath)) {
    console.log(`  yt-dlp: found (.bin/yt-dlp)`);
    return;
  }

  // 3. yt-dlp-wrap로 다운로드
  console.log('  yt-dlp: not found, downloading...');
  try {
    const { default: YTDlpWrap } = await import('yt-dlp-wrap');
    if (!existsSync(binDir)) {
      mkdirSync(binDir, { recursive: true });
    }
    await YTDlpWrap.downloadFromGithub(ytdlpBinPath);
    console.log(`  yt-dlp: downloaded to .bin/yt-dlp`);
  } catch (error) {
    console.warn(`  yt-dlp: download failed - ${error.message}`);
    console.warn('          manual install: https://github.com/yt-dlp/yt-dlp#installation');
  }
}
```

**다운로드 URL**: GitHub releases (yt-dlp-wrap가 자동 선택)
- Windows: `yt-dlp.exe`
- Linux/macOS: `yt-dlp`

**우선순위**:
1. 시스템 yt-dlp
2. `.bin/yt-dlp` (이전 설치)
3. GitHub에서 다운로드

**에러 처리**: 다운로드 실패 시 경고만 표시 (치명적 오류 아님)

---

#### 3. Streamlink

**전략**: 시스템 → .bin/ → 플랫폼별 다운로드

```javascript
async function setupStreamlink() {
  // 1. 시스템 streamlink 확인
  if (hasCommand('streamlink')) {
    try {
      const version = execFileSync('streamlink', ['--version'], { encoding: 'utf-8' }).trim();
      console.log(`  streamlink: ${version} (system)`);
    } catch {
      console.log('  streamlink: found (system)');
    }
    return;
  }

  // 2. .bin/ 확인
  const binPath = getStreamlinkBinPath();
  if (binPath && existsSync(binPath)) {
    const filename = join('.bin', binPath.split('.bin/')[1] || 'streamlink');
    console.log(`  streamlink: found (${filename})`);
    return;
  }

  // 3. 다운로드
  console.log('  streamlink: not found, downloading...');
  try {
    await downloadStreamlink();
    console.log('  streamlink: downloaded successfully');
  } catch (error) {
    console.warn(`  streamlink: download failed - ${error.message}`);
    console.warn('          HLS trimming will be unavailable');
    console.warn('          Install manually: https://streamlink.github.io/install.html');
  }
}
```

**우선순위**:
1. 시스템 streamlink
2. `.bin/streamlink-*` (이전 설치)
3. GitHub에서 다운로드

---

### 플랫폼별 처리

#### Windows

**바이너리 타입**: Portable `.zip` (실행 파일 포함)

**다운로드 URL**:
```
https://github.com/streamlink/windows-builds/releases/download/
  {version}/streamlink-{version}-py314-x86_64.zip
```

**버전**: `8.2.0-1`

**저장 위치**: `.bin/streamlink-win/streamlink.exe`

**다운로드 로직**:
```javascript
if (platform === 'win32') {
  const url = `https://github.com/streamlink/windows-builds/releases/download/${version}/streamlink-${version}-py314-x86_64.zip`;
  console.log(`    Downloading from ${url}`);
  await downloadAndExtract(url, join(binDir, 'streamlink-win'));
}
```

**압축 해제**: `adm-zip` 패키지 사용
```javascript
async function downloadAndExtract(url, destDir) {
  const AdmZip = (await import('adm-zip')).default;
  const tmpZip = join(binDir, 'temp-streamlink.zip');

  try {
    await downloadFile(url, tmpZip);
    const zip = new AdmZip(tmpZip);
    zip.extractAllTo(destDir, true);
  } finally {
    if (existsSync(tmpZip)) {
      unlinkSync(tmpZip);
    }
  }
}
```

**특징**:
- Python 3.14 번들 포함 (의존성 불필요)
- x86_64 아키텍처만 지원

---

#### Linux

**바이너리 타입**: AppImage (자체 실행 가능)

**다운로드 URL**:
```
https://github.com/streamlink/streamlink-appimage/releases/download/
  {version}/streamlink-{version}-cp314-cp314-manylinux_2_28_{arch}.AppImage
```

**아키텍처 지원**:
- x86_64 (`x64`)
- aarch64 (`arm64`)

**저장 위치**:
- x64: `.bin/streamlink-linux-x64.AppImage`
- ARM64: `.bin/streamlink-linux-arm64.AppImage`

**다운로드 로직**:
```javascript
else if (platform === 'linux') {
  const archSuffix = arch === 'arm64' ? 'aarch64' : 'x86_64';
  const url = `https://github.com/streamlink/streamlink-appimage/releases/download/${version}/streamlink-${version}-cp314-cp314-manylinux_2_28_${archSuffix}.AppImage`;
  const destPath = join(binDir, `streamlink-linux-${arch === 'arm64' ? 'arm64' : 'x64'}.AppImage`);
  console.log(`    Downloading from ${url}`);
  await downloadFile(url, destPath);
  execFileSync('chmod', ['+x', destPath]);
}
```

**실행 권한**: `chmod +x` 자동 부여

**특징**:
- FUSE 불필요 (`--appimage-extract-and-run` 플래그 사용)
- glibc 2.28 이상 필요

---

#### macOS

**전략**: 시스템 설치만 지원 (바이너리 제공 안 함)

```javascript
else if (platform === 'darwin') {
  console.warn('    macOS: Please install streamlink via Homebrew:');
  console.warn('    brew install streamlink');
  throw new Error('macOS binary not available');
}
```

**이유**:
- Homebrew가 macOS 표준 패키지 관리자
- 바이너리 배포보다 시스템 통합이 안정적
- 빌드된 바이너리가 제공되지 않음

**사용자 안내**:
```bash
brew install streamlink
```

---

### 에러 처리

#### 1. 네트워크 에러

```javascript
async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'Video-Trimmer' },
    }, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const fileStream = createWriteStream(dest);
      pipeline(res, fileStream)
        .then(resolve)
        .catch(reject);
    }).on('error', reject);
  });
}
```

**처리**:
- 301/302 리다이렉트 자동 따라가기
- HTTP 에러 시 예외 발생
- User-Agent 헤더로 GitHub 제한 회피

---

#### 2. 다운로드 실패

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

**처리**:
- 경고만 표시 (치명적 오류 아님)
- HLS 트리밍 불가 안내
- 수동 설치 가이드 제공

---

#### 3. 명령어 존재 확인

```javascript
function hasCommand(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
```

**장점**:
- `which` 명령어 사용 (Unix/Windows Git Bash 호환)
- 예외를 false로 변환 (간결한 로직)

---

## cut_video.sh (참조용)

### 목적

**파일**: `scripts/cut_video.sh`

**설명**: 이 스크립트는 **실행되지 않으며**, 디버깅 및 로직 참조 목적으로만 존재합니다.

**역할**:
- 프로젝트의 URL 트리밍 기능 원본 참조
- TypeScript 포팅 전 검증용 쉘 스크립트
- Streamlink + FFmpeg 2단계 프로세스 증명

**TypeScript 구현**: `src/app/api/video/trim/route.ts`

---

### 전체 구조

```
┌────────────────────────────────┐
│ 1. 설정 (사용자 입력)           │
│    - URL, START, END, OUTPUT   │
└────────────────────────────────┘
         ↓
┌────────────────────────────────┐
│ 2. OS 감지                     │
│    - macOS / Linux / Windows   │
└────────────────────────────────┘
         ↓
┌────────────────────────────────┐
│ 3. 의존성 확인 및 설치          │
│    - streamlink, ffmpeg        │
└────────────────────────────────┘
         ↓
┌────────────────────────────────┐
│ 4. 시간 계산                   │
│    - START → END 구간 계산      │
└────────────────────────────────┘
         ↓
┌────────────────────────────────┐
│ 5. 다운로드 (2단계)             │
│    Phase 1: Streamlink         │
│    Phase 2: FFmpeg             │
└────────────────────────────────┘
```

---

### 핵심 로직

#### Phase 1: Streamlink 다운로드

**목적**: HLS 스트림에서 특정 구간의 세그먼트 다운로드

```bash
streamlink \
  --hls-start-offset "$START" \
  --stream-segmented-duration "$DUR" \
  "$URL" best -o "temp.mp4"
```

**플래그 설명**:
- `--hls-start-offset`: 시작 시간 (HH:MM:SS)
- `--stream-segmented-duration`: 다운로드 길이 (HH:MM:SS)
- `best`: 최고 화질 선택
- `-o`: 출력 파일 경로

**주의사항**:
- 원본 스크립트는 `--stream-segmented-duration` 사용
- **현재 프로젝트는 `--hls-duration` 사용** (Chzzk 호환성 문제 해결)
- 차이점:
  - `--stream-segmented-duration`: 일부 사이트에서 무시됨 (Chzzk)
  - `--hls-duration`: HLS 전용, 더 안정적

**결과**: `temp.mp4` (타임스탬프가 원본 기준)

---

#### Phase 2: FFmpeg 타임스탬프 리셋

**목적**: 타임스탬프를 0부터 시작하도록 재설정

```bash
ffmpeg -i "temp.mp4" \
  -c copy \
  -avoid_negative_ts make_zero \
  -fflags +genpts \
  "$OUTPUT"
```

**플래그 설명**:
- `-i temp.mp4`: 입력 파일
- `-c copy`: 스트림 복사 (재인코딩 없음)
- `-avoid_negative_ts make_zero`: 음수 타임스탬프 방지
- `-fflags +genpts`: PTS (Presentation Timestamp) 재생성
- `-loglevel error`: 에러만 출력

**왜 필요한가?**:
- Streamlink만 사용 시: 타임스탬프가 원본 기준 (예: 3:05:24부터 시작)
- 플레이어 호환성 문제: 대부분의 플레이어는 0부터 시작하는 타임스탬프 기대
- FFmpeg 리셋 후: 타임스탬프가 00:00:00부터 시작

**결과**: `{OUTPUT}.mp4` (타임스탬프 0부터 시작)

---

### TypeScript 포팅

**원본 쉘 스크립트** vs **TypeScript 구현**

#### 1. 실행 방식

| 쉘 스크립트 | TypeScript |
|------------|-----------|
| 동기 실행 | 비동기 Promise |
| 사용자 대화형 | HTTP API |
| CLI 도구 | 웹 서비스 |

#### 2. 입력 방식

**쉘**:
```bash
URL="https://chzzk.naver.com/video/11569695"
START="3:05:24"
END="3:10:21"
OUTPUT="테스트"
```

**TypeScript**:
```typescript
// POST /api/video/trim
{
  "originalUrl": "https://chzzk.naver.com/video/11569695",
  "startTime": 11124,  // 3:05:24 → 초 단위
  "endTime": 11421,    // 3:10:21 → 초 단위
  "filename": "테스트.mp4"
}
```

#### 3. 출력 방식

**쉘**:
```bash
# 로컬 파일로 저장
"테스트.mp4"
```

**TypeScript**:
```typescript
// HTTP 응답으로 스트리밍
return new Response(fileStream, {
  headers: {
    'Content-Type': 'video/mp4',
    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  },
});
```

#### 4. 에러 처리

**쉘**:
```bash
set -e  # 오류 발생 시 중단

if streamlink ...; then
  log_success "다운로드 완료"
else
  log_error "다운로드 실패"
  exit 1
fi
```

**TypeScript**:
```typescript
try {
  await trimWithStreamlink(originalUrl, startTime, endTime, filename);
} catch (error) {
  console.error('[trim] Error:', error);
  return NextResponse.json(
    { error: '영상 트리밍 중 오류가 발생했습니다.' },
    { status: 500 }
  );
}
```

#### 5. 진행률 표시

**쉘**:
```bash
log_info "구간 다운로드 시작..."
# streamlink 자체 진행률 표시
log_success "다운로드 완료"
```

**TypeScript**:
```typescript
// SSE로 실시간 진행률 스트리밍
POST /api/download/start → jobId
GET /api/download/stream/:jobId → SSE 스트림

// 이벤트:
{ type: 'progress', progress: 45, phase: 'downloading' }
{ type: 'complete', filename: 'video.mp4' }
```

---

### 핵심 차이점 요약

| 항목 | 쉘 스크립트 | TypeScript API |
|-----|-----------|---------------|
| **실행** | 로컬 CLI | HTTP 서버 |
| **입출력** | 파일 → 파일 | HTTP → HTTP |
| **진행률** | 콘솔 출력 | SSE 스트림 |
| **에러** | 종료 코드 | HTTP 상태 코드 |
| **의존성** | 시스템 설치 | 번들 + 자동 다운로드 |
| **OS 지원** | 범용 | Linux 서버 (Vercel) |

---

### TypeScript 구현 파일

**메인 API**: `src/app/api/video/trim/route.ts`

**핵심 함수**:
```typescript
async function trimWithStreamlink(
  url: string,
  startTime: number,
  endTime: number,
  filename: string
): Promise<string>
```

**호출 예시**:
```typescript
export async function POST(request: Request) {
  const { originalUrl, startTime, endTime, filename } = await request.json();

  const outputPath = await trimWithStreamlink(
    originalUrl,
    startTime,
    endTime,
    filename
  );

  const fileStream = createReadStream(outputPath);

  return new Response(fileStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
```

---

## 요약

### setup-deps.mjs

**목적**: 바이너리 의존성 자동 다운로드

**핵심**:
- postinstall 훅으로 자동 실행
- 플랫폼별 바이너리 처리 (Windows .zip, Linux AppImage, macOS 시스템 설치)
- 우선순위: 시스템 > .bin/ > 자동 다운로드

### cut_video.sh

**목적**: 로직 참조용 쉘 스크립트

**핵심**:
- 2단계 프로세스: Streamlink (다운로드) → FFmpeg (타임스탬프 리셋)
- TypeScript로 포팅됨 (`src/app/api/video/trim/route.ts`)
- 실행되지 않음 (디버깅/참조 목적만)

### 학습 포인트

1. **바이너리 관리**: 플랫폼별 자동 다운로드 전략
2. **네트워크 처리**: HTTPS, 리다이렉트, User-Agent
3. **쉘 → TypeScript 포팅**: CLI → HTTP API 변환
4. **2단계 트리밍**: Streamlink + FFmpeg 조합의 필요성

---

## 참고 자료

- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [Streamlink Documentation](https://streamlink.github.io/)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [yt-dlp-wrap GitHub](https://github.com/Athlon1600/yt-dlp-wrap)
