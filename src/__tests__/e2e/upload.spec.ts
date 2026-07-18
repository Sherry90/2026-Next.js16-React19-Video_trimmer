import { test, expect } from "@playwright/test";
import path from "path";

const TEST_VIDEO_PATH = path.join(__dirname, "fixtures", "test-video.mp4");
const TEST_TEXT_PATH = path.join(__dirname, "fixtures", "test.txt");

test.describe("File Upload", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the upload zone on initial load", async ({ page }) => {
    await expect(page.getByText("Drop video file here")).toBeVisible();
  });

  test("rejects unsupported file formats with an error", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_TEXT_PATH);

    await expect(page.getByText(/지원하지 않는 파일 형식/i)).toBeVisible();
  });

  test("accepts a valid video and enters the editing phase", async ({ page }) => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_VIDEO_PATH);

    // Player mounts and the editing-phase Export button appears
    await page.locator("[data-vjs-player]").waitFor({ state: "visible", timeout: 10000 });
    await expect(page.getByTestId("export-button")).toBeVisible({ timeout: 5000 });
  });
});
