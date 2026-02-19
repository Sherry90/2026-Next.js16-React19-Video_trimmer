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

export async function mockTrimApi(page: Page) {
  await page.route('**/api/video/trim', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'video/mp4',
      headers: {
        'Content-Length': '1024',
        'Content-Disposition': "attachment; filename*=UTF-8''trimmed_video.mp4",
      },
      body: Buffer.alloc(1024),
    })
  );
}

export async function mockTrimApiError(page: Page, status: number, message: string) {
  await page.route('**/api/video/trim', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    })
  );
}

export async function loadUrlVideo(page: Page) {
  await mockResolveApi(page);
  await mockProxyApi(page);

  await page.goto('/');

  const urlInput = page.getByTestId('url-input');
  await urlInput.fill('https://www.youtube.com/watch?v=test123');
  await page.getByTestId('url-load-button').click();
  await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });
}
