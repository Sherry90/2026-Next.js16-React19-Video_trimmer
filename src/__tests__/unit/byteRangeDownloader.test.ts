import { promises as fsPromises } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PartialDownloadUnavailableError,
  planRep,
  splitByteRange,
  writeRepClip,
  type RepPlan,
  type TransferCounters,
} from "@/lib/byteRangeDownloader";

const temporaryFiles = new Set<string>();

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await Promise.all([...temporaryFiles].map((path) => fsPromises.unlink(path).catch(() => {})));
  temporaryFiles.clear();
});

function tempFile(label: string): string {
  const path = join(tmpdir(), `video-trimmer-range-${process.pid}-${label}-${Date.now()}.mp4`);
  temporaryFiles.add(path);
  return path;
}

function streamingResponse(
  start: number,
  end: number,
  total: number,
  options: { maxBodyBytes?: number; contentRange?: string | null } = {},
): Response {
  const expected = end - start + 1;
  const bodyBytes = Math.min(expected, options.maxBodyBytes ?? expected);
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bodyBytes) {
        controller.close();
        return;
      }
      const size = Math.min(64 * 1024, bodyBytes - sent);
      controller.enqueue(new Uint8Array(size).fill((start + sent) % 251));
      sent += size;
    },
  });
  const headers = new Headers({ "Content-Length": String(expected) });
  const contentRange =
    options.contentRange === undefined ? `bytes ${start}-${end}/${total}` : options.contentRange;
  if (contentRange !== null) headers.set("Content-Range", contentRange);
  return new Response(body, { status: 206, headers });
}

function makePlan(media: [number, number]): RepPlan {
  return {
    head: Buffer.alloc(32, 9),
    init: [0, 31],
    media,
    clipStartTime: 0,
    mediaBytes: media[1] - media[0] + 1,
    sourceBytes: media[1] + 10_000,
    probeBytes: 128 * 1024,
  };
}

describe("strict disk-streamed Range downloads", () => {
  it("splits ranges into inclusive 8 MiB chunks without a 64 MiB ceiling", () => {
    const size = 65 * 1024 * 1024;
    const chunks = splitByteRange(100, 100 + size - 1, 8 * 1024 * 1024);
    expect(chunks).toHaveLength(9);
    expect(chunks[0]).toEqual({ start: 100, end: 100 + 8 * 1024 * 1024 - 1 });
    expect(chunks.at(-1)?.end).toBe(100 + size - 1);
  });

  it("keeps a >50% and >64 MiB-capable selection on Range and streams exact bytes to disk", async () => {
    const mediaStart = 200_000;
    const mediaBytes = 17 * 1024 * 1024 + 123;
    const plan = makePlan([mediaStart, mediaStart + mediaBytes - 1]);
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const range = new Headers(init?.headers).get("Range");
        expect(range).toMatch(/^bytes=\d+-\d+$/);
        requests.push(range!);
        const match = range!.match(/bytes=(\d+)-(\d+)/)!;
        return streamingResponse(Number(match[1]), Number(match[2]), plan.sourceBytes);
      }),
    );

    const path = tempFile("stream");
    const counters: TransferCounters = { receivedBytes: 0, writtenBytes: 0 };
    let progressBytes = 0;
    await writeRepClip("https://media.invalid/video", plan, path, counters, (bytes) => {
      progressBytes += bytes;
    });

    expect(requests).toHaveLength(3);
    expect(requests.every((range) => range.startsWith("bytes="))).toBe(true);
    expect(counters.receivedBytes).toBe(mediaBytes);
    expect(counters.writtenBytes).toBe(mediaBytes + 32);
    expect(progressBytes).toBe(mediaBytes + 32);
    expect((await fsPromises.stat(path)).size).toBe(mediaBytes + 32);
  });

  it("rejects 200 OK without reading or retaining the full response", async () => {
    let pulls = 0;
    const response = new Response(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          pulls += 1;
          controller.enqueue(new Uint8Array(1024));
        },
      }),
      { status: 200 },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response),
    );
    const path = tempFile("status-200");

    await expect(
      writeRepClip(
        "https://media.invalid/video",
        makePlan([100, 199]),
        path,
        { receivedBytes: 0, writtenBytes: 0 },
        () => {},
      ),
    ).rejects.toBeInstanceOf(PartialDownloadUnavailableError);
    await expect(fsPromises.stat(path)).rejects.toMatchObject({ code: "ENOENT" });
    expect(pulls).toBeLessThanOrEqual(1);
  });

  it("rejects a missing Content-Range immediately", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamingResponse(100, 199, 1000, { contentRange: null })),
    );
    const path = tempFile("bad-content-range");
    await expect(
      writeRepClip(
        "https://media.invalid/video",
        makePlan([100, 199]),
        path,
        { receivedBytes: 0, writtenBytes: 0 },
        () => {},
      ),
    ).rejects.toThrow(/Content-Range/);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(fsPromises.stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a Content-Range whose source total changes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamingResponse(100, 199, 999)),
    );
    const path = tempFile("wrong-source-total");
    await expect(
      writeRepClip(
        "https://media.invalid/video",
        makePlan([100, 199]),
        path,
        { receivedBytes: 0, writtenBytes: 0 },
        () => {},
      ),
    ).rejects.toThrow(/전체 크기 불일치/);
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(fsPromises.stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("retries a short streamed response and does not double-count overwritten bytes", async () => {
    let attempt = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        attempt += 1;
        return streamingResponse(100, 199, 10_199, {
          maxBodyBytes: attempt === 1 ? 40 : undefined,
        });
      }),
    );
    const path = tempFile("retry");
    const counters: TransferCounters = { receivedBytes: 0, writtenBytes: 0 };
    let progressBytes = 0;
    await writeRepClip(
      "https://media.invalid/video",
      makePlan([100, 199]),
      path,
      counters,
      (bytes) => {
        progressBytes += bytes;
      },
    );

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(counters.receivedBytes).toBe(140);
    expect(counters.writtenBytes).toBe(132);
    expect(progressBytes).toBe(132);
    expect((await fsPromises.stat(path)).size).toBe(132);
  });

  it("cleans a partial file when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal("fetch", vi.fn());
    const path = tempFile("abort");
    await expect(
      writeRepClip(
        "https://media.invalid/video",
        makePlan([100, 199]),
        path,
        { receivedBytes: 0, writtenBytes: 0 },
        () => {},
        controller.signal,
      ),
    ).rejects.toThrow(/취소/);
    expect(fetch).not.toHaveBeenCalled();
    await expect(fsPromises.stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("stops after three retries when every response is short", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamingResponse(100, 199, 10_199, { maxBodyBytes: 40 })),
    );
    const path = tempFile("retry-exhausted");
    await expect(
      writeRepClip(
        "https://media.invalid/video",
        makePlan([100, 199]),
        path,
        { receivedBytes: 0, writtenBytes: 0 },
        () => {},
      ),
    ).rejects.toThrow(/짧습니다/);
    expect(fetch).toHaveBeenCalledTimes(4);
    await expect(fsPromises.stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("removes the partial file when a disk write fails with ENOSPC", async () => {
    const samplePath = tempFile("file-handle-prototype");
    const sample = await fsPromises.open(samplePath, "w+");
    const prototype = Object.getPrototypeOf(sample) as {
      write: (...args: unknown[]) => Promise<unknown>;
    };
    await sample.close();
    const noSpace = Object.assign(new Error("no space left on device"), { code: "ENOSPC" });
    vi.spyOn(prototype, "write").mockRejectedValue(noSpace);
    const path = tempFile("enospc");

    await expect(
      writeRepClip(
        "https://media.invalid/video",
        makePlan([100, 199]),
        path,
        { receivedBytes: 0, writtenBytes: 0 },
        () => {},
      ),
    ).rejects.toMatchObject({ code: "ENOSPC" });
    await expect(fsPromises.stat(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("maps a DASH header without moov/sidx to partial-download unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => streamingResponse(0, 127, 128)),
    );
    await expect(planRep("https://media.invalid/video", 0, 1)).rejects.toBeInstanceOf(
      PartialDownloadUnavailableError,
    );
  });
});
