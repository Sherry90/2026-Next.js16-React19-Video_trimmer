import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Video Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display upload zone on initial load', async ({ page }) => {
    await expect(page.getByText(/drag.*drop/i)).toBeVisible();
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
    // This test requires a valid video file
    // For now, we'll skip this test as it requires test fixtures
    test.skip();
  });
});

test.describe('Video Upload - with valid file', () => {
  test.skip('should show progress during upload and FFmpeg loading', async ({ page }) => {
    // This test requires a valid video file and mocking
  });

  test.skip('should transition to editor after upload completes', async ({ page }) => {
    // This test requires a valid video file and mocking
  });
});
