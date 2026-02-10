import { Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TEST_VIDEO_PATH = path.join(FIXTURES_DIR, 'test-video.mp4');

/**
 * Default resolve API response for a test video
 */
export const DEFAULT_RESOLVE_RESPONSE = {
  title: 'Test Video',
  duration: 5,
  thumbnail: '',
  url: 'https://test.example.com/stream.mp4',
  ext: 'mp4',
  streamType: 'mp4' as const,
};

/**
 * Mock POST /api/video/resolve with a success response
 */
export async function mockResolveApi(
  page: Page,
  response = DEFAULT_RESOLVE_RESPONSE,
) {
  await page.route('**/api/video/resolve', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(response),
    });
  });
}

/**
 * Mock POST /api/video/resolve with an error response
 */
export async function mockResolveApiError(
  page: Page,
  status: number,
  error: string,
) {
  await page.route('**/api/video/resolve', (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error }),
    });
  });
}

/**
 * Mock GET /api/video/proxy to serve the test video fixture
 */
export async function mockProxyApi(
  page: Page,
  videoFixturePath = TEST_VIDEO_PATH,
) {
  const videoBuffer = fs.readFileSync(videoFixturePath);

  await page.route('**/api/video/proxy**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'video/mp4',
      headers: {
        'Content-Length': String(videoBuffer.length),
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      },
      body: videoBuffer,
    });
  });
}

/**
 * Mock POST /api/video/trim with a success response (serves video fixture)
 */
export async function mockTrimApi(
  page: Page,
  videoFixturePath = TEST_VIDEO_PATH,
) {
  const videoBuffer = fs.readFileSync(videoFixturePath);

  await page.route('**/api/video/trim', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'video/mp4',
      headers: {
        'Content-Length': String(videoBuffer.length),
        'Content-Disposition': "attachment; filename*=UTF-8''trimmed_video.mp4",
      },
      body: videoBuffer,
    });
  });
}

/**
 * Mock POST /api/video/trim with an error response
 */
export async function mockTrimApiError(
  page: Page,
  status: number,
  error: string,
) {
  await page.route('**/api/video/trim', (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error }),
    });
  });
}

/**
 * Full helper: set up all mocks, navigate, enter URL, and wait for editing phase.
 * Returns after the video player area is visible.
 */
export async function loadUrlVideo(page: Page) {
  // Set up all API mocks
  await mockResolveApi(page);
  await mockProxyApi(page);
  await mockTrimApi(page);

  // Navigate to the app
  await page.goto('/');

  // Enter URL and submit
  const urlInput = page.getByTestId('url-input');
  await urlInput.fill('https://www.youtube.com/watch?v=test123');
  await page.getByTestId('url-load-button').click();

  // Wait for video player to appear (editing phase)
  await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });
}
