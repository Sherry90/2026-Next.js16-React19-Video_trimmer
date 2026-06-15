import { useStore } from '@/stores/useStore';
import type { SSEEvent, DownloadRequest, DownloadJobResponse } from '@/types/sse';
import { calculateOverallProgress, getPhaseMessage } from './sseProgressUtils';
import { generateTrimFilename } from './generateFilename';

/**
 * URL 구간 다운로드 컨트롤러 (모듈 싱글톤, React 생명주기와 독립).
 *
 * editing → processing → completed 전환 중 컴포넌트가 mount/unmount 되어도
 * EventSource가 끊기지 않도록 컴포넌트 외부(모듈 스코프)에서 SSE를 관리한다.
 *
 * 흐름:
 *   1. POST /api/download/start → jobId
 *   2. GET /api/download/stream/[jobId] → SSE 진행률
 *   3. GET /api/download/[jobId] → 완료 파일 → export 결과로 completed 합류
 *
 * 다운로드 파라미터는 store의 videoFile(originalUrl/tbr) + timeline(in/out)에서 읽는다.
 */

let eventSource: EventSource | null = null;

function actions() {
  return useStore.getState();
}

function closeStream() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function fail(message: string) {
  closeStream();
  const s = actions();
  s.setDownloadPhase(null);
  s.setActiveDownloadJobId(null);
  s.setErrorAndTransition(message, 'DOWNLOAD_ERROR');
}

function complete(jobId: string) {
  const s = actions();
  const { videoFile, timeline } = s;
  // URL 소스의 name은 항상 "${title}.mp4" → generateTrimFilename이 .mp4 보존.
  // 파일 소스 트림과 동일한 MMmSSs 포맷으로 통일.
  const filename = generateTrimFilename(
    videoFile?.name || 'video.mp4',
    timeline.inPoint,
    timeline.outPoint
  );

  // blob 적재 없음: 완료 파일은 서버에서 디스크로 직행 스트리밍된다.
  // outputUrl = API URL (jobId 내장 → reset 시 정리에 사용).
  s.setActiveDownloadJobId(null);
  s.setDownloadPhase(null);
  s.setExportResultAndComplete(`/api/download/${jobId}`, filename);
}

function connect(jobId: string) {
  closeStream();
  const es = new EventSource(`/api/download/stream/${jobId}`);
  eventSource = es;

  es.onmessage = (event) => {
    try {
      const data: SSEEvent = JSON.parse(event.data);

      if (data.type === 'progress') {
        const s = actions();
        s.setProgress('trim', calculateOverallProgress(data.phase, data.progress));
        s.setDownloadPhase(data.phase, getPhaseMessage(data.phase, data.processedSeconds, data.totalSeconds));
      } else if (data.type === 'complete') {
        closeStream();
        complete(jobId);
      } else if (data.type === 'error') {
        fail(data.message);
      }
    } catch (err) {
      console.error('[StreamDownload] Failed to parse event:', err);
    }
  };

  es.onerror = () => {
    if (!eventSource) return; // 정상 종료 후 발생한 onerror 무시
    fail('서버 연결이 끊어졌습니다');
  };
}

/**
 * 현재 timeline 구간으로 구간 다운로드를 시작한다.
 * 호출 전 phase는 'processing'으로 전환되어 있어야 한다(진행 UI 표시).
 * 검증 실패 시 false 반환(에러 전환은 호출자가 처리하도록 메시지 throw).
 */
export async function startStreamDownload(): Promise<void> {
  const state = useStore.getState();
  const { videoFile, timeline } = state;

  if (!videoFile || videoFile.source !== 'url' || !videoFile.originalUrl) {
    throw new Error('URL 소스가 아닙니다');
  }

  const { inPoint, outPoint } = timeline;
  if (outPoint <= inPoint) {
    throw new Error('종료 지점이 시작 지점보다 뒤여야 합니다');
  }
  // 구간 길이 상한 없음: 병목이 브라우저 메모리가 아니라 서버 디스크/시간이므로
  // 최종 다운로드를 서버→디스크 직행 스트리밍으로 처리한다(blob 미적재).

  // 이미 진행 중인 job이 있으면 재연결만 (중복 시작 방지)
  if (state.processing.activeDownloadJobId) {
    if (!eventSource) connect(state.processing.activeDownloadJobId);
    return;
  }

  state.setProgress('trim', 0);
  state.setDownloadPhase(null);

  const startResponse = await fetch('/api/download/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: videoFile.originalUrl,
      startTime: inPoint,
      endTime: outPoint,
      filename: videoFile.name || 'video.mp4',
      tbr: videoFile.tbr ?? null,
      // 플레이어에서 고른 화질로 다운로드도 일치 (미선택 시 기본 1080p)
      maxHeight: state.selectedQuality ?? 1080,
    } satisfies DownloadRequest),
  });

  if (!startResponse.ok) {
    const error = await startResponse.json().catch(() => ({}));
    throw new Error(error.error || '다운로드 시작에 실패했습니다');
  }

  const { jobId }: DownloadJobResponse = await startResponse.json();
  state.setActiveDownloadJobId(jobId);
  connect(jobId);
}
