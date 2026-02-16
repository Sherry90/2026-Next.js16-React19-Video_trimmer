# SSE 실시간 Progress 전송 문제 해결

## 날짜
2026-02-16

## 문제 상황

### 증상
- YouTube 다운로드가 백엔드에서는 성공하지만, 프론트엔드는 progress 화면에서 멈춤
- 서버 로그에는 모든 이벤트가 정상적으로 emit되었다고 표시
- 브라우저 콘솔에는 다운로드 완료 후에 모든 이벤트를 한 번에 수신

### 로그 분석
```
[서버]
[SSE] downloading: 100% ✅
[SSE] 📡 Emitting progress to 0 listener(s) ❌

[브라우저]
[SSE Client] EventSource created, readyState: 0
... (24초 동안 아무것도 없음)
[SSE Client] ✅ EventSource connected (24초 후)
[SSE Client] 📨 Received message (모든 메시지 한 번에)
```

---

## 근본 원인

### 1. Listener 참조 손실 (Race Condition)

**위치:** `src/lib/downloadJob.ts` - `updateJobStatus()`

**문제 코드:**
```typescript
function updateJobStatus(jobId: string, updates: Partial<Job>) {
  const job = jobs.get(jobId);
  if (job) {
    jobs.set(jobId, {
      ...job,              // ❌ 새 객체 생성
      ...updates,
      listeners: job.listeners,  // 배열 복사 → 참조 끊김
    });
  }
}
```

**실행 순서:**
1. POST `/api/download/start` → jobId 반환 (await 없음)
2. `startDownloadJob()` 시작 → job 초기화 (listeners: [])
3. 클라이언트 → SSE 연결 → `getJobStream()` 호출 → listener 추가
4. `updateJobStatus()` 호출 → **새 객체 생성** → 리스너 배열 참조 끊김
5. `emitEvent()` 호출 → 빈 배열 참조 → 이벤트 전송 실패

**해결:**
```typescript
function updateJobStatus(jobId: string, updates: Partial<Job>) {
  const job = jobs.get(jobId);
  if (!job) return;

  // ✅ 기존 객체의 속성만 변경 (참조 유지)
  if (updates.status !== undefined) job.status = updates.status;
  if (updates.outputPath !== undefined) job.outputPath = updates.outputPath;
}
```

---

### 2. FFmpeg Progress 미파싱

**위치:** `src/lib/ytdlpDownloader.ts`

**문제:**
yt-dlp가 `--merge-output-format mp4` 옵션을 사용하면:
- 비디오/오디오를 별도 다운로드 (빠름, 또는 캐시됨)
- FFmpeg로 병합 (대부분의 시간 소요)
- Progress는 `[download] XX%`가 아닌 `frame=... time=HH:MM:SS` 형식

**기존 코드:**
```typescript
const progressParser = new YtdlpProgressParser();
// ❌ yt-dlp의 [download] XX% 형식만 파싱
```

**로그:**
```
[DEBUG] yt-dlp stderr: frame= 2463 fps= 49 q=-1.0 size= 22784kB time=00:01:20.34 ...
```

**해결:**
```typescript
const ytdlpFfmpegTracker = new FFmpegProgressTracker(segmentDuration);

const parseProgressLine = (line: string) => {
  // 1. yt-dlp [download] XX% 파싱
  const ytdlpProgress = progressParser.parseLine(line);
  if (ytdlpProgress !== null) {
    updateProgress(ytdlpProgress, 'downloading');
    return;
  }

  // 2. FFmpeg time=HH:MM:SS 파싱 (yt-dlp 내부 병합)
  if (line.includes('frame=') && line.includes('time=')) {
    const ffmpegProgress = ytdlpFfmpegTracker.pushChunk(Buffer.from(line));
    if (ffmpegProgress > 0) {
      updateProgress(ffmpegProgress, 'downloading');
    }
  }
};
```

---

### 3. Next.js SSE 스트림 버퍼링

**위치:** `src/app/api/download/stream/[jobId]/route.ts`

**문제:**
Next.js App Router의 `ReadableStream`이 즉시 스트리밍하지 않고 버퍼링:
- 서버: 이벤트 실시간 emit
- Next.js: 24초 동안 버퍼링 (`render: 24.3s`)
- 브라우저: 완료 후 모든 이벤트 한 번에 수신

**해결:**
```typescript
const stream = new ReadableStream({
  start(controller) {
    const encoder = new TextEncoder();

    // ✅ 즉시 heartbeat 전송 (Next.js에게 응답 시작 신호)
    controller.enqueue(encoder.encode(': connected\n\n'));

    const unsubscribe = getJobStream(jobId, (event) => {
      // 이벤트 전송...
    });
  },
});
```

SSE 프로토콜에서 `:` 로 시작하는 라인은 주석이므로 브라우저가 무시합니다.

---

## 해결 결과

### 수정 후 동작

**서버 로그:**
```
[SSE] 🔌 Client connected to stream: xxx
[SSE] 📤 Initial heartbeat sent
[SSE] 🔌 Listener added to existing job: xxx (total: 1)
[SSE] yt-dlp FFmpeg merge: 15.0%
[SSE] 📡 Emitting progress to 1 listener(s) ✅
[SSE] 📤 Event sent to client: progress ✅
```

**브라우저 로그:**
```
[SSE Client] ✅ EventSource connected successfully (즉시)
[SSE Client] 📨 Received message: downloading 15%
[SSE Client] 📨 Received message: downloading 30%
[SSE Client] 📨 Received message: downloading 50%
...
[SSE Client] 📨 Received message: complete
```

### 개선 사항
✅ 리스너 참조 보존으로 이벤트 전송 성공
✅ FFmpeg progress 파싱으로 실시간 진행률 표시
✅ Heartbeat로 스트림 즉시 시작
✅ 상세 로깅으로 디버깅 용이

---

## 남은 이슈

### Next.js SSE 버퍼링 (부분 해결)
- Heartbeat 추가로 개선되었지만 완전히 해결되지 않음
- 일부 케이스에서 여전히 지연 발생 가능
- 추가 조사 필요: Next.js App Router SSE 구현 패턴

---

## 교훈

1. **객체 참조 유지**: Map에 저장된 객체는 `jobs.set()`으로 재생성하지 말고, 속성만 변경
2. **Progress 파싱 전략**: yt-dlp + FFmpeg 조합 시 stderr에서 FFmpeg 출력 파싱 필수
3. **SSE 버퍼링 대응**: Next.js에서 즉시 데이터 전송 필요 (heartbeat, initial event)
4. **디버깅 로깅**: 리스너 추가/제거, 이벤트 emit 시점 로깅으로 race condition 추적
