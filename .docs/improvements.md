# Video Trimmer 개선사항 목록

## 개요
이 문서는 Video Trimmer 프로젝트의 체계적인 개선을 위한 로드맵입니다.
각 개선사항은 우선순위에 따라 순차적으로 구현됩니다.

## 현재 상태 분석

### 핵심 성능 원리
- **Stream Copy 방식**: FFmpeg의 `-c copy` 플래그로 재인코딩 없이 바이트만 복사
- **처리 시간**: 500MB 파일 기준 2-5초
- **클라이언트 사이드**: 서버 없이 브라우저에서 모든 처리

### 현재 제약사항
1. 키프레임 기반 트리밍으로 1-5초 정확도 오차
2. 파일 크기 제한 (~1-2GB)
3. FFmpeg 프로그레스 정확도 부족
4. 에러 핸들링 부족
5. 단일 파일 처리만 가능
6. 제한적인 포맷 지원

---

## 개선사항 0: 정확도 검증 및 개선

### 📋 목표
**재인코딩 없이** 현재 stream copy 방식에서 트리밍 정확도를 검증하고 최대한 개선

### 🎯 배경 및 문제 정의

**현재 상황**:
- 코드 주석: "키프레임 기반으로 오차 발생 가능" (예: 2-5초 요청 시 0-5초 결과)
- 현재 FFmpeg 명령어: `-ss [start] -i input.mp4 -t [duration] -c copy`
- `-ss`가 `-i` **앞**에 위치 → 빠르지만 키프레임 기반 시킹

**핵심 의문**:
1. **실제로 오차가 발생하는가?** (추측이 아닌 테스트 필요)
2. 오차가 발생한다면 **원인**이 무엇인가?
   - FFmpeg 키프레임 제약?
   - 시간 값 전달 문제?
   - 소수점 정밀도 문제?
3. **재인코딩 없이** 개선할 방법이 있는가?

**핵심 원칙**:
> 이 앱의 가장 큰 장점은 **재인코딩을 하지 않는 것**입니다.
> 재인코딩은 속도(2-5초 → 몇 분), 품질, 앱의 핵심 가치를 모두 희생합니다.
> **최후의 수단으로만 고려**해야 합니다.

### 📁 영향받는 파일
- `src/features/export/utils/trimVideoFFmpeg.ts` - 트리밍 로직
- `.docs/accuracy-test.md` - 테스트 결과 문서 (신규)
- `tests/accuracy/` - 정확도 테스트 스크립트 (신규, 선택사항)

### 🔧 구현 계획

#### Phase 0.1: 현재 정확도 테스트 (필수)

**테스트 방법**:
```typescript
// tests/accuracy/test-trim-accuracy.ts
// 또는 수동 테스트

// 테스트 케이스:
// 1. 짧은 구간 (2-5초, 3초 duration)
// 2. 중간 구간 (30-45초, 15초 duration)
// 3. 긴 구간 (120-180초, 60초 duration)
// 4. 프레임 경계 (정확히 키프레임에서 시작/종료)
// 5. 프레임 중간 (키프레임 사이에서 시작/종료)

// 각 케이스별:
// - 요청한 시간 vs 실제 결과물의 시간
// - 오차 측정 (ms 단위)
// - 시작 프레임과 끝 프레임 확인
```

**측정 도구**:
- FFmpeg로 메타데이터 확인: `ffmpeg -i output.mp4 2>&1 | grep Duration`
- 브라우저 video.duration 확인
- FFprobe로 정밀 분석: `ffprobe -show_format -show_streams output.mp4`

**기대 결과**:
- 오차 없음 → 현재 방식이 이미 정확함, 문서만 수정
- 오차 있음 → Phase 0.2로 진행

#### Phase 0.2: 오차 원인 분석 (오차 발생 시)

**분석 항목**:

1. **시간 전달 정밀도**:
   ```typescript
   // src/features/export/utils/trimVideoFFmpeg.ts 확인
   // startTime, endTime이 number (초 단위)
   // FFmpeg에 전달 시 소수점이 제대로 전달되는가?
   // 예: 2.345초 → "2.345" (O) vs "2" (X)
   ```

2. **FFmpeg 키프레임 제약**:
   - 입력 비디오의 키프레임 간격 확인: `ffprobe -select_streams v -show_frames input.mp4 | grep key_frame`
   - 키프레임이 1-2초마다 있는가? 5초마다 있는가?

3. **FFmpeg 옵션 문제**:
   - `-ss` 위치에 따른 영향
   - `-c copy`와 `-ss` 조합의 제약사항

#### Phase 0.3: Stream Copy 방식 내에서 개선 (오차 발생 시)

**시도할 방법들** (우선순위 순):

##### 방법 1: `-ss` 위치 변경
```typescript
// 현재 (빠르지만 부정확):
['-ss', startTime, '-i', input, '-t', duration, '-c', 'copy']

// 시도 1 (느리지만 정확?):
['-i', input, '-ss', startTime, '-t', duration, '-c', 'copy']

// 문제: 주석에 "often drops video stream with -c copy"라고 되어 있음
// → 실제로 테스트 필요! 모든 경우에 drop하는가?
```

**테스트**:
- 다양한 비디오 포맷 (MP4, WebM, MOV)
- 다양한 코덱 (H.264, H.265, VP9)
- 비디오 스트림이 drop되는지 확인

##### 방법 2: `-accurate_seek` 옵션 추가
```typescript
// FFmpeg의 정확한 시킹 옵션
['-ss', startTime, '-i', input, '-t', duration, '-c', 'copy', '-accurate_seek']

// 또는
['-accurate_seek', '-ss', startTime, '-i', input, '-t', duration, '-c', 'copy']
```

##### 방법 3: `-copyts` + `-start_at_zero` 조합
```typescript
// 타임스탬프 보존 옵션들
['-ss', startTime, '-i', input, '-t', duration, '-c', 'copy', '-copyts', '-start_at_zero']
```

##### 방법 4: 두 단계 `-ss` (input seeking + output seeking)
```typescript
// Input seeking + Output seeking
['-ss', startTime, '-i', input, '-ss', '0', '-t', duration, '-c', 'copy']
```

##### 방법 5: 시간 포맷 변경
```typescript
// 초 단위 (현재): "2.5"
// 타임코드: "00:00:02.500"
// ms 단위: "2500ms"

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = (seconds % 60).toFixed(3);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.padStart(6, '0')}`;
}
```

**각 방법 테스트 후**:
- 정확도 개선 여부
- 처리 속도 변화
- 비디오/오디오 스트림 정상 유지 여부
- 다양한 포맷/코덱 호환성

#### Phase 0.4: UI 및 사용자 피드백 (선택사항)

**만약 완벽한 해결이 불가능하다면**:

```typescript
// src/features/timeline/components/TimelineEditor.tsx
// 키프레임 위치 시각화
// - 타임라인에 키프레임 마커 표시
// - 사용자가 키프레임 근처로 조정 가능하도록 안내

// src/features/export/components/TrimAccuracyWarning.tsx
// 정확도 경고 및 설명
// "키프레임 제약으로 ±X초 오차가 발생할 수 있습니다"
// "더 정확한 트리밍이 필요하시면 키프레임 위치를 참고해주세요"
```

#### Phase 0.5: 재인코딩 옵션 추가 (최후의 수단)

**오직 다음 조건을 모두 만족할 때만**:
1. ✅ Phase 0.1에서 심각한 오차 확인 (예: 5초+ 오차)
2. ✅ Phase 0.2에서 원인이 FFmpeg 키프레임 제약임을 확인
3. ✅ Phase 0.3의 모든 방법 시도했으나 실패
4. ✅ 사용자가 정확도를 절대적으로 필요로 함

**구현 시**:
```typescript
// src/types/export.ts
export type TrimMode = 'fast' | 'accurate';

// src/features/export/utils/trimVideoFFmpeg.ts
if (mode === 'accurate') {
  // 재인코딩 모드
  // 경고: 느림 (1-5분), 품질 손실 가능
  await ffmpeg.exec([
    '-i', input,
    '-ss', startTime,
    '-t', duration,
    '-c:v', 'libx264',
    '-preset', 'ultrafast', // 빠른 인코딩
    '-crf', '18', // 높은 품질
    '-c:a', 'copy', // 오디오는 복사
    output
  ]);
}
```

**UI 경고**:
```
⚠️ 정확한 트리밍 모드
- 예상 시간: 1-5분 (파일 크기에 따라)
- 약간의 품질 저하 가능
- 파일 크기 증가 가능
```

### ✅ 완료 기준

**Phase 0.1 (필수)**:
- [ ] 최소 5개 테스트 케이스 실행
- [ ] 실제 오차 측정 및 문서화
- [ ] 오차 발생 여부 결정

**Phase 0.2 (오차 발생 시)**:
- [ ] 시간 전달 정밀도 확인
- [ ] 키프레임 간격 분석
- [ ] 원인 특정 및 문서화

**Phase 0.3 (오차 발생 시)**:
- [ ] 5가지 방법 중 최소 3개 테스트
- [ ] 최적 방법 선정
- [ ] 코드 적용 및 재테스트
- [ ] 개선 전후 비교

**Phase 0.4 (완벽한 해결 불가 시)**:
- [ ] 사용자에게 제약사항 명확히 전달
- [ ] 키프레임 시각화 (선택사항)

**Phase 0.5 (최후의 수단)**:
- [ ] Phase 0.1-0.3 완료 증명
- [ ] 재인코딩 모드 구현
- [ ] 사용자 경고 UI
- [ ] 두 모드 비교 테스트

### 📝 테스트 결과 문서

테스트 결과는 `.docs/accuracy-test.md`에 기록:

```markdown
# 트리밍 정확도 테스트 결과

## 테스트 환경
- 브라우저: Chrome 120
- 테스트 파일: sample.mp4 (H.264, 1080p, 30fps)
- 키프레임 간격: 2초

## Phase 0.1: 현재 정확도

| 요청 시간 | 결과 시간 | 오차 | 비고 |
|----------|----------|-----|------|
| 2-5초 (3초) | 0-5초 (5초) | +2초 | 시작점이 0초 키프레임으로 |
| 30-45초 (15초) | 30-46초 (16초) | +1초 | 종료점이 46초 키프레임으로 |

## Phase 0.3: 개선 시도

### 방법 1: -ss 위치 변경
- 결과: 비디오 스트림 drop 발생
- 사용 불가

### 방법 2: -accurate_seek
- 결과: 오차 ±0.5초로 개선
- 속도 영향: 미미 (+0.5초)
- ✅ 채택
```

---

## 개선사항 1: 에러 핸들링 강화

### 📋 목표
FFmpeg 에러를 사용자 친화적으로 변환하고 다양한 에러 케이스 처리

### 🎯 배경
- 현재: 기본 에러 메시지만 표시
- 개선: 에러 원인 파악 및 해결 방법 안내

### 📁 영향받는 파일
- `src/features/export/utils/trimVideoFFmpeg.ts` - 에러 파싱
- `src/utils/errorHandler.ts` - 에러 핸들러 (신규)
- `src/features/export/components/ErrorDisplay.tsx` - 에러 UI (신규)
- `src/stores/useStore.ts` - 에러 상태 개선

### 🔧 구현 계획

#### 1.1 에러 타입 정의
```typescript
// src/types/error.ts
export type ErrorCode =
  | 'MEMORY_INSUFFICIENT'
  | 'CODEC_UNSUPPORTED'
  | 'FILE_CORRUPTED'
  | 'FFMPEG_LOAD_FAILED'
  | 'PROCESSING_FAILED'
  | 'UNKNOWN';

export interface AppError {
  code: ErrorCode;
  message: string;
  userMessage: string; // 사용자 친화적 메시지
  solution?: string; // 해결 방법
  technicalDetails?: string; // 기술적 상세 정보
}
```

#### 1.2 FFmpeg 에러 파싱
```typescript
// src/utils/errorHandler.ts
export function parseFFmpegError(error: Error): AppError {
  const message = error.message.toLowerCase();

  // 메모리 부족
  if (message.includes('out of memory') || message.includes('malloc')) {
    return {
      code: 'MEMORY_INSUFFICIENT',
      message: error.message,
      userMessage: '메모리가 부족합니다.',
      solution: '더 작은 파일을 사용하거나 브라우저를 재시작해주세요.',
      technicalDetails: error.message
    };
  }

  // 지원하지 않는 코덱
  if (message.includes('unknown codec') || message.includes('decoder not found')) {
    return {
      code: 'CODEC_UNSUPPORTED',
      userMessage: '지원하지 않는 비디오 포맷입니다.',
      solution: 'MP4, WebM, MOV 등 일반적인 포맷으로 변환 후 시도해주세요.',
      technicalDetails: error.message
    };
  }

  // 파일 손상
  if (message.includes('invalid data') || message.includes('moov atom not found')) {
    return {
      code: 'FILE_CORRUPTED',
      userMessage: '비디오 파일이 손상되었습니다.',
      solution: '원본 파일을 확인하거나 다른 파일로 시도해주세요.',
      technicalDetails: error.message
    };
  }

  // 기본 에러
  return {
    code: 'PROCESSING_FAILED',
    userMessage: '비디오 처리 중 오류가 발생했습니다.',
    solution: '다시 시도하거나 다른 파일을 사용해주세요.',
    technicalDetails: error.message
  };
}
```

#### 1.3 메모리 사전 체크
```typescript
// src/features/export/utils/trimVideoFFmpeg.ts
export async function trimVideoFFmpeg(options: TrimOptions) {
  // 메모리 체크
  if (!checkMemoryAvailability(options.inputFile.size)) {
    throw new Error('MEMORY_INSUFFICIENT: Not enough memory to process this file');
  }

  try {
    // 트리밍 로직
  } catch (error) {
    const appError = parseFFmpegError(error as Error);
    throw appError;
  }
}
```

#### 1.4 에러 표시 UI
```typescript
// src/features/export/components/ErrorDisplay.tsx
// 표시 정보:
// - 에러 아이콘
// - 사용자 친화적 메시지
// - 해결 방법 (있는 경우)
// - 기술적 상세 정보 (접기/펼치기)
// - 다시 시도 버튼
// - 이슈 리포트 링크 (선택사항)
```

### ✅ 완료 기준
- [ ] 에러 타입 정의
- [ ] FFmpeg 에러 파싱 로직
- [ ] 메모리 사전 체크 구현
- [ ] ErrorDisplay 컴포넌트 생성
- [ ] 다양한 에러 케이스 테스트
- [ ] 사용자 친화적 메시지 검증

---

## 개선사항 2: 프로그레스 정확도 개선

### 📋 목표
FFmpeg 실제 처리 시간을 파싱하여 정확한 프로그레스 표시

### 🎯 배경
- 현재: FFmpeg의 불명확한 progress 이벤트 사용
- 개선: FFmpeg 로그에서 `time=` 파싱하여 실제 진행률 계산

### 📁 영향받는 파일
- `src/hooks/useFFmpeg.ts` - FFmpeg 로그 파싱
- `src/features/export/components/ExportProgress.tsx` - 프로그레스 표시 개선
- `src/stores/useStore.ts` - 프로그레스 상태 구조 변경

### 🔧 구현 계획

#### 2.1 FFmpeg 로그 파싱
```typescript
// src/hooks/useFFmpeg.ts
ffmpeg.on('log', ({ message }) => {
  // FFmpeg 출력 예: "frame=  120 fps= 30 q=-1.0 size=    1024kB time=00:00:04.00 bitrate=2097.2kbits/s speed=1.2x"

  const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (timeMatch) {
    const [_, hours, minutes, seconds] = timeMatch;
    const processedTime = parseInt(hours) * 3600 +
                          parseInt(minutes) * 60 +
                          parseFloat(seconds);

    const progress = (processedTime / totalDuration) * 100;
    onProgress(Math.min(progress, 100));
  }
});
```

#### 2.2 프로그레스 상태 구조 개선
```typescript
// src/stores/useStore.ts
interface ProcessingState {
  phase: AppPhase;
  progress: number; // 0-100
  progressDetails: {
    stage: 'loading' | 'processing' | 'writing' | 'complete';
    processedTime: number; // 처리된 시간 (초)
    totalTime: number; // 전체 시간 (초)
    fps: number; // 현재 fps
    speed: number; // 처리 속도 (1.0x, 2.0x 등)
  };
}
```

#### 2.3 상세 프로그레스 UI
```typescript
// src/features/export/components/ExportProgress.tsx
// 표시 정보:
// - 전체 프로그레스 바
// - 처리된 시간 / 전체 시간
// - 현재 FPS
// - 처리 속도 (예: 2.3x)
// - 예상 남은 시간
```

### ✅ 완료 기준
- [ ] FFmpeg 로그 파싱 로직 구현
- [ ] 프로그레스 상태 구조 개선
- [ ] ExportProgress 컴포넌트 업데이트
- [ ] 실제 처리 중 프로그레스 정확도 확인
- [ ] 예상 남은 시간 계산 정확도 테스트

---

## 개선사항 3: 파일 크기 제한 완화

### 📋 목표
1-2GB를 넘는 대용량 파일도 처리 가능하도록 개선

### 🎯 배경
- 현재: 브라우저 메모리에 전체 파일 로드 (~1-2GB 제한)
- 개선: 청크 단위 처리 또는 메모리 최적화

### 📁 영향받는 파일
- `src/features/upload/utils/validateFile.ts` - 검증 로직 수정
- `src/constants/file.ts` - 파일 크기 상수 업데이트
- `src/features/export/utils/trimVideoFFmpeg.ts` - 청크 처리 (선택사항)
- `src/features/upload/components/UploadZone.tsx` - 경고 메시지

### 🔧 구현 계획

#### 3.1 파일 크기 상수 업데이트
```typescript
// src/constants/file.ts
export const FILE_SIZE = {
  RECOMMENDED_MAX: 500 * 1024 * 1024, // 500MB (권장)
  SOFT_MAX: 2 * 1024 * 1024 * 1024,   // 2GB (경고)
  HARD_MAX: 5 * 1024 * 1024 * 1024,   // 5GB (제한)
} as const;
```

#### 3.2 검증 로직 수정
```typescript
// src/features/upload/utils/validateFile.ts
export function validateFile(file: File) {
  // 권장 크기 초과 시 경고 (처리는 허용)
  if (file.size > FILE_SIZE.RECOMMENDED_MAX) {
    return {
      valid: true,
      warning: `파일이 ${formatFileSize(FILE_SIZE.RECOMMENDED_MAX)}를 초과합니다. 처리 시간이 길어질 수 있습니다.`
    };
  }

  // 하드 제한 초과 시 거부
  if (file.size > FILE_SIZE.HARD_MAX) {
    return {
      valid: false,
      error: `파일 크기가 ${formatFileSize(FILE_SIZE.HARD_MAX)}를 초과합니다.`
    };
  }
}
```

#### 3.3 메모리 사용량 모니터링
```typescript
// src/utils/memoryMonitor.ts
export function checkMemoryAvailability(fileSize: number): boolean {
  if ('memory' in performance) {
    const mem = (performance as any).memory;
    const available = mem.jsHeapSizeLimit - mem.usedJSHeapSize;
    return available > fileSize * 1.5; // 1.5배 여유 필요
  }
  return true; // API 없으면 허용
}
```

#### 3.4 사용자 경고 UI
```typescript
// src/features/upload/components/FileSizeWarning.tsx
// 대용량 파일 업로드 시:
// - 예상 처리 시간 표시
// - 메모리 부족 위험 경고
// - 계속 진행 여부 확인
```

### ✅ 완료 기준
- [ ] 파일 크기 상수 업데이트
- [ ] 다층 검증 로직 구현 (권장/경고/제한)
- [ ] 메모리 모니터링 유틸리티 추가
- [ ] FileSizeWarning 컴포넌트 생성
- [ ] 2GB+ 파일로 테스트
- [ ] 메모리 부족 시 적절한 에러 처리

---

## 개선사항 3: 프로그레스 정확도 개선

### 📋 목표
FFmpeg 실제 처리 시간을 파싱하여 정확한 프로그레스 표시

### 🎯 배경
- 현재: FFmpeg의 불명확한 progress 이벤트 사용
- 개선: FFmpeg 로그에서 `time=` 파싱하여 실제 진행률 계산

### 📁 영향받는 파일
- `src/hooks/useFFmpeg.ts` - FFmpeg 로그 파싱
- `src/features/export/components/ExportProgress.tsx` - 프로그레스 표시 개선
- `src/stores/useStore.ts` - 프로그레스 상태 구조 변경

### 🔧 구현 계획

#### 3.1 FFmpeg 로그 파싱
```typescript
// src/hooks/useFFmpeg.ts
ffmpeg.on('log', ({ message }) => {
  // FFmpeg 출력 예: "frame=  120 fps= 30 q=-1.0 size=    1024kB time=00:00:04.00 bitrate=2097.2kbits/s speed=1.2x"

  const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (timeMatch) {
    const [_, hours, minutes, seconds] = timeMatch;
    const processedTime = parseInt(hours) * 3600 +
                          parseInt(minutes) * 60 +
                          parseFloat(seconds);

    const progress = (processedTime / totalDuration) * 100;
    onProgress(Math.min(progress, 100));
  }
});
```

#### 3.2 프로그레스 상태 구조 개선
```typescript
// src/stores/useStore.ts
interface ProcessingState {
  phase: AppPhase;
  progress: number; // 0-100
  progressDetails: {
    stage: 'loading' | 'processing' | 'writing' | 'complete';
    processedTime: number; // 처리된 시간 (초)
    totalTime: number; // 전체 시간 (초)
    fps: number; // 현재 fps
    speed: number; // 처리 속도 (1.0x, 2.0x 등)
  };
}
```

#### 3.3 상세 프로그레스 UI
```typescript
// src/features/export/components/ExportProgress.tsx
// 표시 정보:
// - 전체 프로그레스 바
// - 처리된 시간 / 전체 시간
// - 현재 FPS
// - 처리 속도 (예: 2.3x)
// - 예상 남은 시간
```

### ✅ 완료 기준
- [ ] FFmpeg 로그 파싱 로직 구현
- [ ] 프로그레스 상태 구조 개선
- [ ] ExportProgress 컴포넌트 업데이트
- [ ] 실제 처리 중 프로그레스 정확도 확인
- [ ] 예상 남은 시간 계산 정확도 테스트

---

## 개선사항 4: 추가 포맷 지원

### 📋 목표
더 많은 비디오 포맷 지원 및 포맷 변환 기능 추가

### 🎯 배경
- 현재: MP4, WebM, OGG, MOV, AVI, MKV
- 추가: FLV, M4V, TS, 3GP, WMV 등

### 📁 영향받는 파일
- `src/features/upload/utils/validateFile.ts` - 포맷 검증
- `src/constants/file.ts` - 지원 포맷 목록
- `src/features/export/components/FormatConverter.tsx` - 포맷 변환 UI (신규)

### 🔧 구현 계획

#### 4.1 지원 포맷 확대
```typescript
// src/constants/file.ts
export const SUPPORTED_FORMATS = {
  video: [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/quicktime', // MOV
    'video/x-msvideo', // AVI
    'video/x-matroska', // MKV
    'video/x-flv', // FLV (추가)
    'video/x-m4v', // M4V (추가)
    'video/mp2t', // TS (추가)
    'video/3gpp', // 3GP (추가)
    'video/x-ms-wmv', // WMV (추가)
  ],
  extensions: [
    '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv',
    '.flv', '.m4v', '.ts', '.3gp', '.wmv' // 추가
  ]
} as const;
```

#### 4.2 포맷 변환 기능
```typescript
// src/features/export/utils/convertFormat.ts
export async function convertFormat(
  ffmpeg: FFmpeg,
  inputFile: File,
  targetFormat: 'mp4' | 'webm' | 'mov',
  onProgress: (progress: number) => void
): Promise<Blob> {
  await ffmpeg.writeFile('input', await fetchFile(inputFile));

  const outputExt = targetFormat;
  const codecOptions = getCodecOptions(targetFormat);

  await ffmpeg.exec([
    '-i', 'input',
    ...codecOptions,
    `output.${outputExt}`
  ]);

  const data = await ffmpeg.readFile(`output.${outputExt}`);
  return new Blob([data], { type: `video/${targetFormat}` });
}

function getCodecOptions(format: string): string[] {
  switch (format) {
    case 'mp4':
      return ['-c:v', 'libx264', '-c:a', 'aac'];
    case 'webm':
      return ['-c:v', 'libvpx-vp9', '-c:a', 'libopus'];
    case 'mov':
      return ['-c:v', 'libx264', '-c:a', 'aac'];
    default:
      return ['-c', 'copy'];
  }
}
```

#### 4.3 포맷 변환 UI
```typescript
// src/features/export/components/FormatConverter.tsx
// 기능:
// - 타겟 포맷 선택 (드롭다운)
// - 변환 옵션 (코덱, 품질 등)
// - 변환 시작
// - 변환 프로그레스
// - 변환된 파일 다운로드
```

### ✅ 완료 기준
- [ ] 지원 포맷 목록 확대
- [ ] 포맷 검증 로직 업데이트
- [ ] convertFormat 유틸리티 구현
- [ ] FormatConverter UI 컴포넌트
- [ ] 각 포맷별 변환 테스트
- [ ] 코덱 옵션 최적화

---

## 구현 우선순위

### Phase 0: 정확도 검증 (최우선)
**반드시 먼저 완료해야 함** - 다른 개선사항의 방향성을 결정

0. ✅ **개선사항 0: 정확도 검증 및 개선**
   - 실제 오차 발생 여부 테스트
   - Stream copy 방식 내에서 개선 방법 탐색
   - 재인코딩은 최후의 수단으로만 고려
   - 예상 소요: 1-2일

### Phase 1: 기본 개선 (필수)
Phase 0 완료 후 진행

1. ✅ **개선사항 1: 에러 핸들링 강화** (안정성)
   - 다양한 에러 케이스 처리
   - 사용자 친화적 메시지
   - 메모리 부족, 지원하지 않는 코덱 등
   - 예상 소요: 2-3일

2. ✅ **개선사항 2: 프로그레스 정확도 개선** (UX)
   - FFmpeg 로그 파싱
   - 실시간 진행률 표시
   - 예상 남은 시간 계산
   - 예상 소요: 1-2일

3. ✅ **개선사항 3: 파일 크기 제한 완화** (실용성)
   - 다층 검증 (권장/경고/제한)
   - 메모리 모니터링
   - 대용량 파일 경고
   - 예상 소요: 1-2일

### Phase 2: 기능 확장
Phase 1 완료 후 진행

4. ✅ **개선사항 4: 추가 포맷 지원** (호환성)
   - FLV, M4V, TS, 3GP, WMV 등
   - 포맷 변환 기능
   - 예상 소요: 2-3일

### 제외된 항목
- ❌ **배치 처리**: 사용자가 한 번에 하나의 작업만 수행하면 충분. 복잡성 대비 효용 낮음.

---

## 테스트 계획

### 각 개선사항별 테스트
0. **정확도 검증**:
   - 다양한 트리밍 구간에서 실제 오차 측정
   - 키프레임 간격별 영향 분석
   - FFmpeg 옵션별 정확도 비교
1. **에러 핸들링**: 의도적으로 다양한 에러 발생 (손상된 파일, 메모리 부족 등)
2. **프로그레스**: 실제 처리 시간 vs 표시 시간 비교
3. **파일 크기**: 500MB, 1GB, 2GB, 3GB 파일 테스트
4. **포맷 지원**: 모든 지원 포맷 업로드 및 변환 테스트

### 통합 테스트
- 모든 개선사항을 함께 사용하는 시나리오
- 성능 벤치마크 (처리 시간, 메모리 사용량)
- 다양한 브라우저 호환성 테스트 (Chrome, Firefox, Safari, Edge)

---

## 성공 지표

### 정량적 지표
- [ ] **트리밍 정확도**: 오차 확인 및 개선 (재인코딩 없이)
- [ ] **처리 가능한 최대 파일 크기**: 1GB → 3GB+
- [ ] **프로그레스 정확도**: ±20% → ±5%
- [ ] **에러 복구율**: 향상
- [ ] **지원 포맷 수**: 6개 → 11개

### 정성적 지표
- [ ] **트리밍 정확도**: 사용자가 지정한 구간이 정확히 반영됨
- [ ] **재인코딩 없음**: 앱의 핵심 장점(속도, 품질) 유지
- [ ] **에러 이해**: 사용자가 에러 메시지를 이해하고 해결 가능
- [ ] **프로그레스 신뢰**: 프로그레스가 실제 처리 상황을 반영
- [ ] **포맷 접근성**: 다양한 포맷 지원으로 접근성 향상

---

## 참고 자료

### FFmpeg 문서
- [FFmpeg 공식 문서](https://ffmpeg.org/documentation.html)
- [FFmpeg.wasm 문서](https://ffmpegwasm.netlify.app/)
- [FFmpeg 코덱 가이드](https://trac.ffmpeg.org/wiki/Encode)

### 브라우저 제약사항
- [SharedArrayBuffer 요구사항](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)
- [브라우저 메모리 제한](https://developer.chrome.com/blog/memory-inspector/)

---

_최종 업데이트: 2026-01-28_
_작성자: Claude Code_
