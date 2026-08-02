import {
  getStoreActions,
  getMediaSnapshot,
  getTimelineSnapshot,
  getProcessingSnapshot,
} from "@/stores/snapshot";
import type { SSEEvent, DownloadRequest, DownloadJobResponse } from "@/types/sse";
import { calculateOverallProgress, getPhaseMessage } from "./sseProgressUtils";
import { generateTrimFilename } from "./generateFilename";

/**
 * URL 구간 다운로드 컨트롤러. 모듈 싱글톤으로 SSE를 관리해, editing → processing →
 * completed 전환 중 컴포넌트가 mount/unmount 되어도 EventSource가 끊기지 않는다.
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
  return getStoreActions();
}

function closeStream() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function fail(message: string, code: string = "DOWNLOAD_ERROR", technicalDetails?: string) {
  closeStream();
  const s = actions();
  s.setDownloadPhase(null);
  s.setActiveDownloadJobId(null);
  s.setErrorAndTransition(message, code, technicalDetails);
}

function complete(jobId: string) {
  // 데이터 read는 snapshot 게터, action 호출은 actions()로 분리(비반응형 접근면 일원화).
  const { videoFile } = getMediaSnapshot();
  const { inPoint, outPoint } = getTimelineSnapshot();
  // URL 소스의 name은 항상 "${title}.mp4" → generateTrimFilename이 .mp4 보존.
  // 파일 소스 트림과 동일한 MMmSSs 포맷으로 통일.
  const sourceName = videoFile?.name || "video.mp4";
  const mp4Name = `${sourceName.replace(/\.[^.]+$/, "") || "video"}.mp4`;
  const filename = generateTrimFilename(mp4Name, inPoint, outPoint);

  // blob 적재 없음: 완료 파일은 서버에서 디스크로 직행 스트리밍된다.
  // outputUrl = API URL (jobId 내장 → reset 시 정리에 사용).
  const s = actions();
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

      if (data.type === "progress") {
        const s = actions();
        const isLocalFile = getMediaSnapshot().videoFile?.source === "file";
        const progress =
          isLocalFile && data.phase === "processing"
            ? Math.round(20 + data.progress * 0.8)
            : calculateOverallProgress(data.phase, data.progress);
        s.setProgress("trim", progress);
        s.setDownloadPhase(
          data.phase,
          getPhaseMessage(data.phase, data.processedSeconds, data.totalSeconds),
        );
      } else if (data.type === "complete") {
        closeStream();
        complete(jobId);
      } else if (data.type === "error") {
        fail(data.message, data.code ?? "DOWNLOAD_ERROR", data.technicalDetails);
      }
    } catch (err) {
      console.error("[StreamDownload] Failed to parse event:", err);
    }
  };

  es.onerror = () => {
    if (!eventSource) return; // 정상 종료 후 발생한 onerror 무시
    fail(
      "서버 연결이 끊어졌습니다",
      "NETWORK_ERROR",
      `EventSource 연결 끊김 (jobId=${jobId}). 서버가 실행 중인지, 네트워크가 안정적인지 확인하세요.`,
    );
  };
}

/**
 * 현재 timeline 구간으로 구간 다운로드를 시작한다.
 * 호출 전 phase는 'processing'으로 전환되어 있어야 한다(진행 UI 표시).
 * 검증 실패 시 false 반환(에러 전환은 호출자가 처리하도록 메시지 throw).
 */
function uploadLocalFile(
  file: File,
  startTime: number,
  endTime: number,
  onProgress: (progress: number) => void,
): Promise<DownloadJobResponse> {
  return new Promise((resolve, reject) => {
    const query = new URLSearchParams({
      startTime: String(startTime),
      endTime: String(endTime),
      filename: file.name,
    });
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/download/file?${query.toString()}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 20));
    };
    xhr.onerror = () => reject(new Error("로컬 처리 서버로 파일을 전달하지 못했습니다"));
    xhr.onabort = () => reject(new Error("파일 전달이 취소되었습니다"));
    xhr.onload = () => {
      let body: Partial<DownloadJobResponse> & { error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status < 200 || xhr.status >= 300 || !body.jobId) {
        reject(new Error(body.error || `파일 전달에 실패했습니다 (${xhr.status})`));
        return;
      }
      onProgress(20);
      resolve({ jobId: body.jobId });
    };
    xhr.send(file);
  });
}

export async function startStreamDownload(): Promise<void> {
  // 데이터 read는 snapshot 게터, action 호출은 actions()로 분리(비반응형 접근면 일원화).
  const { videoFile, selectedQuality } = getMediaSnapshot();
  const timeline = getTimelineSnapshot();

  if (!videoFile) throw new Error("비디오 파일이 없습니다");

  const { inPoint, outPoint } = timeline;
  if (outPoint <= inPoint) {
    throw new Error("종료 지점이 시작 지점보다 뒤여야 합니다");
  }
  // 구간 길이 상한 없음: 병목이 브라우저 메모리가 아니라 서버 디스크/시간이므로
  // 최종 다운로드를 서버→디스크 직행 스트리밍으로 처리한다(blob 미적재).

  const s = actions();

  // 이미 진행 중인 job이 있으면 재연결만 (중복 시작 방지)
  const activeJobId = getProcessingSnapshot().activeDownloadJobId;
  if (activeJobId) {
    if (!eventSource) connect(activeJobId);
    return;
  }

  s.setProgress("trim", 0);
  s.setDownloadPhase(null);

  let job: DownloadJobResponse;
  if (videoFile.source === "file") {
    if (!videoFile.file) throw new Error("로컬 파일을 찾을 수 없습니다");
    job = await uploadLocalFile(videoFile.file, inPoint, outPoint, (progress) =>
      s.setProgress("trim", progress),
    );
  } else {
    if (!videoFile.originalUrl) throw new Error("원본 URL이 없습니다");
    const startResponse = await fetch("/api/download/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: videoFile.originalUrl,
        startTime: inPoint,
        endTime: outPoint,
        filename: videoFile.name || "video.mp4",
        tbr: videoFile.tbr ?? null,
        maxHeight: selectedQuality ?? 1080,
      } satisfies DownloadRequest),
    });
    if (!startResponse.ok) {
      const error = await startResponse.json().catch(() => ({}));
      throw new Error(error.error || "다운로드 시작에 실패했습니다");
    }
    job = (await startResponse.json()) as DownloadJobResponse;
  }

  const { jobId } = job;
  s.setActiveDownloadJobId(jobId);
  connect(jobId);
}
