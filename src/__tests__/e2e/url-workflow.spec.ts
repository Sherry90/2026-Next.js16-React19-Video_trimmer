import { test, expect } from '@playwright/test';
import {
  mockResolveApi,
  mockResolveApiError,
  mockProxyApi,
  mockSpectrogramApi,
  mockSpectrogramApiError,
  mockWaveformApi,
  mockWaveformEmpty,
  mockDownloadSuccess,
  mockDownloadStart,
  mockDownloadStreamError,
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
    await mockWaveformApi(page);

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
    await mockWaveformApi(page);

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
    await mockWaveformApi(page);

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

  // 파형/스펙트럴 토글은 제거됨 — 스펙트럼은 항상 파형 위에 겹쳐 자동 렌더된다.
  test('should auto-render the spectrogram canvas overlay', async ({ page }) => {
    await mockSpectrogramApi(page);
    await loadUrlVideo(page);

    const canvas = page.getByTestId('spectrogram-canvas');
    await expect(canvas).toBeVisible();

    // 캔버스에 실제 색이 칠해졌는지(스펙트럼 데이터가 렌더됐는지) 확인
    await expect.poll(async () => {
      return canvas.evaluate((node) => {
        const canvasElement = node as HTMLCanvasElement;
        if (canvasElement.width === 0 || canvasElement.height === 0) return 0;
        const ctx = canvasElement.getContext('2d');
        if (!ctx) return 0;
        const image = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
        const colors = new Set<string>();
        for (let i = 0; i < image.data.length; i += 400) {
          colors.add(`${image.data[i]},${image.data[i + 1]},${image.data[i + 2]},${image.data[i + 3]}`);
          if (colors.size > 3) return colors.size;
        }
        return colors.size;
      });
    }, { timeout: 5000 }).toBeGreaterThan(3);
  });

  // 파형도 없고(빈 peaks) 스펙트럼도 실패하면 빈 상태 메시지가 떠야 한다(무한 로딩 금지).
  test('should show empty message when both waveform and spectrum are unavailable', async ({ page }) => {
    await mockResolveApi(page);
    await mockProxyApi(page);
    await mockWaveformEmpty(page);
    await mockSpectrogramApiError(page);

    await page.goto('/');
    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://www.youtube.com/watch?v=test123');
    await page.getByTestId('url-load-button').click();
    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });

    await expect(page.getByTestId('waveform-empty-message')).toContainText(
      '스펙트럼을 표시할 수 없습니다',
      { timeout: 10000 }
    );
  });

  test('should set In/Out points via the time inputs', async ({ page }) => {
    await loadUrlVideo(page);

    const inInput = page.getByLabel('In', { exact: true });
    const outInput = page.getByLabel('Out', { exact: true });

    await inInput.fill('00:00:10.000');
    await inInput.press('Enter');
    await expect(inInput).toHaveValue('00:00:10.000');

    await outInput.fill('00:00:30.000');
    await outInput.press('Enter');
    await expect(outInput).toHaveValue('00:00:30.000');
  });
});

test.describe('URL Source Trimming & Download', () => {
  test('should complete export → download flow', async ({ page }) => {
    await mockResolveApi(page);
    await mockProxyApi(page);
    await mockWaveformApi(page);
    // 구간 다운로드(SSE) 성공 흐름 — 500ms 지연으로 processing UI를 관찰
    await mockDownloadSuccess(page, 500);

    await page.goto('/');
    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://www.youtube.com/watch?v=test123');
    await page.getByTestId('url-load-button').click();
    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });

    // Export 클릭
    await page.getByTestId('export-button').click();

    // 처리 진행 UI 노출 (지연 응답으로 포착 가능)
    await expect(page.getByTestId('export-progress')).toBeVisible({ timeout: 5000 });

    // 완료 화면
    await expect(page.getByTestId('download-button')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Video Ready!')).toBeVisible();
  });

  test('should show error and allow retry on download failure', async ({ page }) => {
    await mockResolveApi(page);
    await mockProxyApi(page);
    await mockWaveformApi(page);
    // 다운로드 시작은 성공하되 SSE 스트림이 에러 이벤트를 보냄
    await mockDownloadStart(page);
    await mockDownloadStreamError(page, '트리밍에 실패했습니다');

    await page.goto('/');
    const urlInput = page.getByTestId('url-input');
    await urlInput.fill('https://www.youtube.com/watch?v=test123');
    await page.getByTestId('url-load-button').click();
    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });

    // Export 클릭
    await page.getByTestId('export-button').click();

    // 에러 표시 + 재시도 버튼
    await expect(page.getByTestId('error-display')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('retry-button')).toBeVisible();
  });

  test('should return to idle after "Edit Another File"', async ({ page }) => {
    await mockResolveApi(page);
    await mockProxyApi(page);
    await mockWaveformApi(page);
    await mockDownloadSuccess(page);
    await loadUrlVideo(page);

    // Export
    await page.getByTestId('export-button').click();

    // 완료 화면 대기
    await expect(page.getByTestId('download-button')).toBeVisible({ timeout: 30000 });

    // Edit Another
    await page.getByTestId('edit-another-button').click();

    // 초기 화면 복귀
    await expect(page.getByTestId('url-input')).toBeVisible();
    await expect(page.getByText('Drop video file here')).toBeVisible();
  });
});

test.describe('Full URL Workflow', () => {
  test('URL input → load → export → download → edit another', async ({ page }) => {
    await mockResolveApi(page);
    await mockProxyApi(page);
    await mockWaveformApi(page);
    await mockDownloadSuccess(page);

    await page.goto('/');

    // 1. URL 입력
    const urlInput = page.getByTestId('url-input');
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://www.youtube.com/watch?v=test123');

    // 2. Load
    await page.getByTestId('url-load-button').click();
    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });

    // 3. Export
    const exportButton = page.getByTestId('export-button');
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // 4. 완료 대기
    await expect(page.getByTestId('download-button')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Video Ready!')).toBeVisible();

    // 5. Edit Another
    await page.getByTestId('edit-another-button').click();

    // 초기 상태 복귀
    await expect(page.getByTestId('url-input')).toBeVisible();
    await expect(page.getByText('Drop video file here')).toBeVisible();
  });
});
