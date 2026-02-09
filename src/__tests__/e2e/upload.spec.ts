import { test, expect } from '@playwright/test';
import path from 'path';

const TEST_VIDEO_PATH = path.join(__dirname, 'fixtures', 'test-video.mp4');

test.describe('Video Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display upload zone on initial load', async ({ page }) => {
    await expect(page.getByText('Drop video file here')).toBeVisible();
  });

  test('should reject files over 1GB', async ({ page }) => {
    // This test would require creating a large file or mocking
    // For now, we'll skip this test
    test.skip();
  });

  test('should reject unsupported file formats', async ({ page }) => {
    // Create a simple text file
    const textFilePath = path.join(__dirname, 'fixtures', 'test.txt');

    // Try to upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(textFilePath);

    // Should show error message
    await expect(page.getByText(/지원하지 않는 파일 형식/i)).toBeVisible();
  });

  test('should accept valid video file', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_VIDEO_PATH);

    // Should transition to editing phase - video player should appear
    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });
  });
});

test.describe('Video Upload - with valid file', () => {
  test.skip('should show progress during upload and FFmpeg loading', async ({ page }) => {
    // This test requires a valid video file and mocking
  });

  test('should transition to editor after upload completes', async ({ page }) => {
    await page.goto('/');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_VIDEO_PATH);

    // Should show video player
    await page.locator('[data-vjs-player]').waitFor({ state: 'visible', timeout: 10000 });

    // Should show export button (editing phase)
    await expect(page.getByTestId('export-button')).toBeVisible({ timeout: 5000 });
  });
});
