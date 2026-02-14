# URL 다운로드 Progress 개선 작업 (2026-02-13)

## 개요

URL 스트리밍 다운로드의 진행률 표시 안정화 작업. 초기 세그먼트 기반 파싱에서 파일 크기 기반 추적으로 전환하고, 리팩토링을 통해 코드 품질 향상.

---

## 1단계: 세그먼트 파싱 문제 해결

### 문제
- 진행률이 30-42%에서 100%로 점프
- Streamlink가 모든 세그먼트를 로그하지 않음

### 해결
- **이중 파싱 구현**: 세그먼트 로그 + 일반 진행률 (`[download]`, `(Xs @ kb/s)`)
- **중복 방지**: `seenSegments` Set으로 재파싱 시 중복 카운팅 방지
- **Streamlink 파라미터**: `--hls-duration` 사용하여 정확한 구간 다운로드

### 한계
- Streamlink 로그 출력의 불확실성
- 세그먼트 간격이 불규칙하여 진행률 예측 어려움

---

## 2단계: 파일 크기 기반 Progress로 전환

### 이유
세그먼트 파싱의 근본적 한계를 극복하기 위해 더 안정적인 방법 채택

### 구현

**비트레이트 정보 수집**:
```typescript
// formatSelector.ts - tbr 필드 추가
interface FormatSelection {
  url: string;
  streamType: 'hls' | 'mp4';
  tbr: number | null; // kbps
}
```

**파일 크기 기반 polling** (200ms 간격):
```javascript
const estimatedBitrate = tbr || 2500; // kbps
const estimatedBytes = (estimatedBitrate * 1024 / 8) * segmentDuration;

setInterval(async () => {
  const stats = await fsPromises.stat(tempFile);
  const progress = Math.min(100, (stats.size / estimatedBytes) * 100);
  updateDownloadProgress(progress);
}, 200);
```

### 결과
- ✅ 안정적이고 예측 가능한 진행률
- ✅ 0.5초마다 부드러운 업데이트 (200ms polling + 정수 % 중복 제거)
- ✅ Streamlink 로그에 의존하지 않음

---

## 3단계: Progress 역행 방지

### 문제
Phase-based 시스템에서 각 phase마다 0-100%를 표시하여, phase 전환 시 역행하는 것처럼 보임:
```
downloading: 88% → processing: 0% → processing: 100%  ❌
```

### 해결
클라이언트에서 phase별 가중치 적용 (useSocketDownload.ts):
```typescript
let overallProgress: number;
if (data.phase === 'downloading') {
  overallProgress = Math.round(data.progress * 0.9);  // 0-90%
} else if (data.phase === 'processing') {
  overallProgress = Math.round(90 + data.progress * 0.1);  // 90-100%
} else {
  overallProgress = 100;
}
```

### 결과
```
downloading: 88% (79%) → processing: 0% (90%) → processing: 100% (100%)  ✅
```

---

## 4단계: TypeScript 전환 및 리팩토링

### 목적
- 타입 안전성 확보
- 코드 가독성 향상
- 유지보수성 개선

### 변경사항

**파일 크기 46% 감소**:
- `progressParser`: 549줄 → 292줄 (-47%)
- `socketHandlers`: 454줄 → 246줄 (-46%)
- **합계**: 1003줄 → 538줄 (-465줄)

**주요 개선**:
1. JavaScript → TypeScript 전환
2. CommonJS (`require`) → ES modules (`import`/`export`)
3. 중복 코드 제거:
   - `runProcessWithTimeout` 함수로 Promise 래퍼 통합
   - `updateProgress` 함수로 다운로드/FFmpeg 진행률 업데이트 통합
4. 불필요한 주석 제거
5. 조건문 및 변수 간소화

---

## 최종 아키텍처

### Socket.IO 이벤트 구조
```typescript
// Progress 이벤트
socket.emit('progress', {
  jobId: string,
  progress: number,        // 0-100 (phase별 실제 진행률)
  processedSeconds: number,
  totalSeconds: number,
  phase: 'downloading' | 'processing' | 'completed'
});
```

### 2-Phase 처리 프로세스
1. **Downloading Phase** (0-100% → 클라이언트 0-90%):
   - Streamlink로 HLS 세그먼트 다운로드
   - 파일 크기 polling으로 진행률 추적
   - 200ms 간격 업데이트

2. **Processing Phase** (0-100% → 클라이언트 90-100%):
   - FFmpeg로 타임스탬프 리셋 (`-c copy`)
   - FFmpeg progress 이벤트 파싱
   - `out_time_ms` / `progress=end` 추적

---

## 테스트 결과

- ✅ TypeScript 타입 체크: 에러 없음
- ✅ 단위 테스트: 110개 통과
- ✅ Progress 역행: 없음
- ✅ 업데이트 간격: 부드러움 (200ms polling, 1% 단위 emit)

---

## 주요 학습

1. **Streamlink 로그의 불확실성**: 세그먼트 로그가 모든 구간에서 출력되지 않음
2. **파일 크기가 더 안정적**: 예측 가능하고 일관된 진행률 제공
3. **Phase별 가중치의 중요성**: 사용자 경험을 위해 클라이언트 측 변환 필요
4. **리팩토링의 가치**: 코드 품질 향상과 동시에 크기 46% 감소

---

## 관련 파일

### 핵심 파일
- `src/lib/socketHandlers.ts` - Socket.IO 핸들러, 파일 크기 polling
- `src/lib/progressParser.ts` - FFmpeg progress 파서
- `src/features/url-input/hooks/useSocketDownload.ts` - 클라이언트 progress 가중치
- `src/lib/formatSelector.ts` - tbr 정보 추출

### 의존성
- `socket.io` / `socket.io-client` - 실시간 통신
- `tsx` - TypeScript 런타임

---

## 커밋 히스토리

1. `feat: 비트레이트 정보 추가로 파일 크기 추정 기반 마련` (a640f11)
2. `feat: Socket.IO 기반 실시간 다운로드 서버 구현` (970717d)
3. `feat: 클라이언트 Socket.IO 다운로드 훅 구현` (5649510)
4. `feat: 다운로드 진행률 파싱 유틸리티 추가` (6d2c3d2)
5. `chore: Socket.IO 의존성 추가` (faf71d7)
6. `feat: 서버 측 CommonJS 유틸리티 추가` (09fb6bc)
7. `refactor: progressParser와 socketHandlers를 TypeScript로 전환 및 리팩토링` (5aa7e5f)
8. `fix: Phase별 가중치 적용으로 Progress 역행 방지` (55e988d)
9. `chore: tsx 의존성 추가 및 dev 스크립트 업데이트` (3166700)
