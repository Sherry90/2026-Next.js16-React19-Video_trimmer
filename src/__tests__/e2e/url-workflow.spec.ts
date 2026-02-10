import { test, expect } from '@playwright/test';
import {
  mockResolveApi,
  mockResolveApiError,
  mockProxyApi,
  mockTrimApi,
  mockTrimApiError,
  loadUrlVideo,
  DEFAULT_RESOLVE_RESPONSE,
} from './helpers';

test.describe('URL Input & Video Load', () => {
  test('should display URL input and Load button on initial page', async ({ page }) => {
    await page.goto('/');

    const urlInput = page.getByTestId('url-input');
    const loadButton = page.getByTestId('url-load-button');

    await expect(urlInput).toBeVisible();
    await expect(loadButton).toBeVisible();
    await expect(loadButton).toBeDisabled(); // empty input
  });

  test('should load video after entering URL and clicking Load', async ({ page }) => {
    await mockResolveApi(page);
    await mockProxyApi(page);

    await page.goto('/');

    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://www.youtube.com/watch?v=test123');

    const loadButton = page.getByTestId('url-load-button');
    await expect(loadButton).toBeEnabled();
    await loadButton.click();

    // Should transition to editing phase with video player
    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('should submit URL with Enter key', async ({ page }) => {
    await mockResolveApi(page);
    await mockProxyApi(page);

    await page.goto('/');

    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://www.youtube.com/watch?v=test123');
    await urlInput.press('Enter');

    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });
  });

  test('should show loading state while resolving', async ({ page }) => {
    // Use a delayed resolve to observe loading state
    await page.route('**/api/video/resolve', async (route) => {
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(DEFAULT_RESOLVE_RESPONSE),
      });
    });
    await mockProxyApi(page);

    await page.goto('/');

    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://www.youtube.com/watch?v=test123');
    await page.getByTestId('url-load-button').click();

    // Should show loading indicator
    await expect(page.getByTestId('url-loading')).toBeVisible();

    // Button should show "Loading..."
    await expect(page.getByTestId('url-load-button')).toHaveText('Loading...');
  });

  test('should show error on resolve API failure', async ({ page }) => {
    await mockResolveApiError(page, 500, '영상 정보를 가져올 수 없습니다');

    await page.goto('/');

    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://www.youtube.com/watch?v=test123');
    await page.getByTestId('url-load-button').click();

    // Should show error message
    await expect(page.getByTestId('url-error')).toBeVisible();
    await expect(page.getByTestId('url-error')).toContainText('영상 정보를 가져올 수 없습니다');
  });
});

test.describe('URL Source Editing', () => {
  test('should show video player after URL load', async ({ page }) => {
    await loadUrlVideo(page);

    // Video player should be visible
    await expect(page.locator('.video-js')).toBeVisible();
  });

  test('should show Export button in editing phase', async ({ page }) => {
    await loadUrlVideo(page);

    await expect(page.getByTestId('export-button')).toBeVisible();
    await expect(page.getByTestId('export-button')).toHaveText('Export');
  });
});

test.describe('URL Source Trimming & Download', () => {
  test('should complete export → download flow', async ({ page }) => {
    // Use a delayed trim response to observe processing state
    await mockResolveApi(page);
    await mockProxyApi(page);

    const fs = await import('fs');
    const path = await import('path');
    const videoBuffer = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'test-video.mp4')
    );

    await page.route('**/api/video/trim', async (route) => {
      // Delay to allow processing UI to appear
      await new Promise((r) => setTimeout(r, 500));
      await route.fulfill({
        status: 200,
        contentType: 'video/mp4',
        headers: {
          'Content-Length': String(videoBuffer.length),
          'Content-Disposition': "attachment; filename*=UTF-8''trimmed_video.mp4",
        },
        body: videoBuffer,
      });
    });

    await page.goto('/');
    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://www.youtube.com/watch?v=test123');
    await page.getByTestId('url-load-button').click();
    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });

    // Click Export
    await page.getByTestId('export-button').click();

    // Should show progress (with delayed response we can catch it)
    await expect(page.getByTestId('export-progress')).toBeVisible({ timeout: 5000 });

    // Should eventually show download screen
    await expect(page.getByTestId('download-button')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Video Ready!')).toBeVisible();
  });

  test('should show error and allow retry on trim failure', async ({ page }) => {
    await mockResolveApi(page);
    await mockProxyApi(page);
    // Mock trim to fail
    await mockTrimApiError(page, 500, '트리밍에 실패했습니다');

    await page.goto('/');

    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://www.youtube.com/watch?v=test123');
    await page.getByTestId('url-load-button').click();
    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });

    // Click Export
    await page.getByTestId('export-button').click();

    // Should show error display
    await expect(page.getByTestId('error-display')).toBeVisible({ timeout: 15000 });

    // Retry button should be visible
    await expect(page.getByTestId('retry-button')).toBeVisible();
  });

  test('should return to idle after "Edit Another File"', async ({ page }) => {
    await loadUrlVideo(page);

    // Export
    await page.getByTestId('export-button').click();

    // Wait for download screen
    await expect(page.getByTestId('download-button')).toBeVisible({ timeout: 30000 });

    // Click Edit Another
    await page.getByTestId('edit-another-button').click();

    // Should return to upload/URL input screen
    await expect(page.getByTestId('url-input')).toBeVisible();
    await expect(page.getByText('Drop video file here')).toBeVisible();
  });
});

test.describe('Full URL Workflow', () => {
  test('URL input → load → export → download → edit another', async ({ page }) => {
    // Set up all mocks
    await mockResolveApi(page);
    await mockProxyApi(page);
    await mockTrimApi(page);

    await page.goto('/');

    // Step 1: Enter URL
    const urlInput = page.getByTestId('url-input');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://www.youtube.com/watch?v=test123');

    // Step 2: Load
    await page.getByTestId('url-load-button').click();
    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });

    // Step 3: Export
    const exportButton = page.getByTestId('export-button');
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // Step 4: Wait for completion
    await expect(page.getByTestId('download-button')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Video Ready!')).toBeVisible();

    // Step 5: Edit Another
    await page.getByTestId('edit-another-button').click();

    // Back to initial state
    await expect(page.getByTestId('url-input')).toBeVisible();
    await expect(page.getByText('Drop video file here')).toBeVisible();
  });
});
