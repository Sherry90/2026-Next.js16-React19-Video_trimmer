import type { Page } from '@playwright/test';

/**
 * E2E 테스트용 API mock 헬퍼
 */

export const DEFAULT_RESOLVE_RESPONSE = {
  title: 'Test Video',
  duration: 120,
  thumbnail: 'https://example.com/thumb.jpg',
  url: 'https://example.com/stream.mp4',
  ext: 'mp4',
  streamType: 'mp4',
  tbr: 2500,
};

export async function mockResolveApi(page: Page, response = DEFAULT_RESOLVE_RESPONSE) {
  await page.route('**/api/video/resolve', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    })
  );
}

export async function mockResolveApiError(page: Page, status: number, message: string) {
  await page.route('**/api/video/resolve', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    })
  );
}

export async function mockProxyApi(page: Page) {
  await page.route('**/api/video/proxy**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'video/mp4',
      body: Buffer.alloc(1024),
    })
  );
}

export async function mockWaveformApi(page: Page) {
  await page.route('**/api/video/waveform**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        duration: 120,
        peaks: [Array.from({ length: 120 }, (_, index) => (index % 10) / 10)],
      }),
    })
  );
}

// 오디오가 없는(빈 peaks) 응답 — 파형 빈 상태 검증용
export async function mockWaveformEmpty(page: Page) {
  await page.route('**/api/video/waveform**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ duration: 120, peaks: [[]] }),
    })
  );
}

export async function mockSpectrogramApi(page: Page) {
  await page.route('**/api/video/spectrogram**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        duration: 120,
        sampleRate: 8000,
        fftSize: 256,
        frames: Array.from({ length: 96 }, (_, x) =>
          Array.from({ length: 64 }, (_, y) => ((x + y) % 16) / 15)
        ),
      }),
    })
  );
}

export async function mockSpectrogramApiError(page: Page) {
  await page.route('**/api/video/spectrogram**', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: '스펙트럼 추출 실패' }),
    })
  );
}

// URL 소스 Export는 서버 구간 다운로드(SSE) 흐름을 탄다:
//   POST /api/download/start → { jobId }
//   GET  /api/download/stream/[jobId] → SSE 진행률/완료/에러
//   GET  /api/download/[jobId] → 완료 파일
const DOWNLOAD_JOB_ID = 'e2e-test-job';

function sseBody(events: object[]): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
}

export async function mockDownloadStart(page: Page, jobId = DOWNLOAD_JOB_ID) {
  await page.route('**/api/download/start', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ jobId }),
    })
  );
}

// 진행 → 완료 SSE. delayMs로 처리 UI를 관찰할 시간을 준다.
export async function mockDownloadStreamSuccess(page: Page, delayMs = 0) {
  await page.route('**/api/download/stream/**', async (route) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody([
        { type: 'progress', phase: 'downloading', progress: 50 },
        { type: 'complete' },
      ]),
    });
  });
}

export async function mockDownloadStreamError(page: Page, message: string) {
  await page.route('**/api/download/stream/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: sseBody([{ type: 'error', message }]),
    })
  );
}

// 모든 다운로드 mock을 한 번에 설치 (성공 흐름)
export async function mockDownloadSuccess(page: Page, delayMs = 0) {
  await mockDownloadStart(page);
  await mockDownloadStreamSuccess(page, delayMs);
}

export async function loadUrlVideo(page: Page) {
  await mockResolveApi(page);
  await mockProxyApi(page);
  await mockWaveformApi(page);

  await page.goto('/');

  const urlInput = page.getByTestId('url-input');
  await urlInput.fill('https://www.youtube.com/watch?v=test123');
  await page.getByTestId('url-load-button').click();
  await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });
}
