# /src/utils - 공통 유틸리티

이 디렉토리는 **클라이언트와 서버 모두에서 사용 가능한 순수 유틸리티 함수**를 포함합니다.

## 파일 목록

### API 관련
- **apiUtils.ts** - API 요청/응답 유틸리티
  - 요청 검증 (validateTrimRequest, validateDownloadRequest)
  - 에러 처리 (handleApiError, parseYtdlpError)

### 시간 관련
- **timeFormatter.ts** - 시간 형식 변환 유틸리티
  - formatTime: HH:MM:SS.mmm 형식
  - formatTimeHHMMSS: HH:MM:SS 형식 (streamlink용)
  - parseTime: 문자열 → 초 변환
  - formatDuration: 읽기 쉬운 형식

### 수학 관련
- **mathUtils.ts** - 수학 유틸리티
  - clamp: 값 범위 제한
  - toPercentage: 백분율 변환 (0-100)

### 문자열 관련
- **stringUtils.ts** - 문자열 유틸리티
  - stripAnsi: ANSI escape code 제거
  - isEmpty: 빈 문자열 검사
  - safeString: 안전한 문자열 변환

### 메모리 관련
- **memoryMonitor.ts** - 브라우저 메모리 모니터링
  - 메모리 API 사용 가능 여부 확인
  - 파일 처리 가능 여부 판단

### 기타
- **formatBytes.ts** - 바이트 크기 형식화 (1024 → "1 KB")
- **ffmpegLogParser.ts** - FFmpeg 로그 파싱

## 특징

✅ **브라우저 및 Node.js 환경 모두 지원**
- Node.js 전용 API 사용 금지 (fs, child_process 등)
- 순수 JavaScript/TypeScript 코드만 사용

✅ **부작용(side-effect) 없는 순수 함수**
- 입력에만 의존하는 결정론적 함수
- 테스트가 용이함

## 사용 예시

```typescript
// ✅ 어디서든 사용 가능
import { clamp, toPercentage } from '@/utils/mathUtils';
import { formatTime } from '@/utils/timeFormatter';

// 클라이언트 컴포넌트
'use client';
const progress = toPercentage(50, 100); // 50

// API route
export async function POST() {
  const time = formatTime(3661.5); // "01:01:01.500"
}
```

## 디렉토리 구분

| 디렉토리 | 환경 | Node.js API | 예시 |
|---------|------|-------------|------|
| `/src/lib` | 서버 전용 | ✅ 사용 | child_process, fs |
| `/src/utils` | 공통 | ❌ 금지 | 순수 함수만 |
