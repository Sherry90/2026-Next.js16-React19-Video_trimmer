import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import type { IncomingMessage, ServerResponse } from "http";
import { readFileSync, existsSync, createReadStream, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parse } from "url";
import type { ParsedUrlQuery } from "querystring";
import { Readable } from "stream";
import type { ReadableStream as NodeWebReadableStream } from "stream/web";
import next from "next";
import type { Job, JobEvent, JobListener } from "./src/lib/downloadTypes";

// ── Next 우회 raw 핸들러들 (다운로드 파일/진행률 SSE/미디어 프록시) ──
// 공통 이유: 장수명/대용량 스트림을 Next 핸들러에 태우면 Next/Turbopack이 그 Response를
// next-swc 브리지로 계속 마샬링하며 JS 힙을 폭증시켜 OOM(dev에서 실측, prod 의존 위험).
// raw http res에 Node 스트림으로 직접 pipe하면 OS 백프레셔 + next-swc 미경유 → 누수 제거.
//
// 다운로드 완료 파일 경로는 다운로더 규약과 동일: join(tmpdir(), `download_${jobId}.mp4`) (ytdlp/streamlink 공통)
const JOBID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * GET /api/download/<jobId> 를 가로채 파일을 직접 스트리밍한다.
 * @returns 처리했으면 true(=Next로 넘기지 않음), 아니면 false.
 */
function tryServeDownload(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  if (req.method !== "GET") return false;
  const m = pathname.match(/^\/api\/download\/([^/]+)$/);
  if (!m) return false; // /start, /stream/<id> 등은 매칭 안 됨
  const jobId = m[1];
  if (!JOBID_RE.test(jobId)) return false; // path traversal·비정상 id 차단 → Next로 폴백

  const filePath = join(tmpdir(), `download_${jobId}.mp4`);
  if (!existsSync(filePath)) return false; // 아직 미완료 → Next 라우트가 적절한 4xx 반환

  const stat = statSync(filePath);
  const total = stat.size;

  // Range 지원 (브라우저 다운로드 재개/부분 요청 대비)
  const range = req.headers["range"];
  let start = 0;
  let end = total - 1;
  let status = 200;
  if (range) {
    const rm = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (rm) {
      if (rm[1]) start = parseInt(rm[1], 10);
      if (rm[2]) end = parseInt(rm[2], 10);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || end >= total) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${total}`);
        res.end();
        return true;
      }
      status = 206;
    }
  }

  res.statusCode = status;
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", String(end - start + 1));
  if (status === 206) res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);

  console.log(
    `[download-raw] file via raw server (Next 우회): ${jobId} ${(total / 1048576).toFixed(1)}MB`,
  );
  const fileStream = createReadStream(filePath, { start, end });
  fileStream.on("error", (err: Error) => {
    console.error("[download-raw] stream error:", err.message);
    if (!res.headersSent) res.statusCode = 500;
    res.end();
  });
  // 클라이언트 끊김 시 디스크 read 즉시 중단
  res.on("close", () => fileStream.destroy());
  fileStream.pipe(res);
  return true;
}

// 진행률 SSE도 raw 우회(상단 공통 이유 참고 — 7분 열린 SSE 스트림이 특히 심한 누수 벡터).
// job 레지스트리는 downloadJob.ts가 globalThis.__vtDownloadJobs에 올려둔 걸 공유한다.
const SSE_ORPHAN_GRACE_MS = 30_000; // appConfig.DOWNLOAD.JOB_ORPHAN_GRACE_PERIOD_MS와 동일 유지

function tryServeProgressSse(req: IncomingMessage, res: ServerResponse, pathname: string): boolean {
  if (req.method !== "GET") return false;
  const m = pathname.match(/^\/api\/download\/stream\/([^/]+)$/);
  if (!m) return false;
  const jobId = m[1];
  if (!JOBID_RE.test(jobId)) return false;

  const registry = (globalThis as unknown as { __vtDownloadJobs?: Map<string, Job> })
    .__vtDownloadJobs;
  const job = registry?.get(jobId);
  // 레지스트리/잡 없음(미시작·만료) → 짧은 요청이라 누수 없음. Next 라우트가 적절히 처리하게 폴백.
  if (!job) return false;

  console.log(`[download-raw] SSE via raw server (Next 우회): ${jobId} status=${job.status}`);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  const send = (event: object) => res.write(`data: ${JSON.stringify(event)}\n\n`);

  // 재연결 시 종료 상태 즉시 반영
  if (job.status === "completed") {
    send({ type: "complete" });
    res.end();
    return true;
  }
  if (job.status === "failed") {
    send({
      type: "error",
      message: job.errorMessage ?? "다운로드에 실패했습니다",
      code: job.errorCode,
      technicalDetails: job.errorDetails,
    });
    res.end();
    return true;
  }

  res.write(": connected\n\n"); // 초기 플러시(버퍼링 방지)

  let closed = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    const cur = registry?.get(jobId);
    if (cur) {
      cur.listeners = cur.listeners.filter((l: JobListener) => l !== listener);
      // 마지막 리스너 이탈 + 실행 중 → grace 후 orphan abort (downloadJob.getJobStream과 동일 정책)
      if (cur.listeners.length === 0 && cur.status === "running" && !cur.orphanCleanupScheduled) {
        cur.orphanCleanupScheduled = true;
        setTimeout(() => {
          const j = registry?.get(jobId);
          if (j && j.status === "running" && j.listeners.length === 0) {
            console.log(`[download-raw] cancelling orphaned job: ${jobId}`);
            j.abort?.();
          }
        }, SSE_ORPHAN_GRACE_MS);
      }
    }
  };
  const listener = (event: JobEvent) => {
    if (closed) return;
    try {
      send(event);
      if (event.type === "complete" || event.type === "error") {
        cleanup();
        res.end();
      }
    } catch {
      cleanup();
    }
  };

  job.listeners.push(listener);
  res.on("close", cleanup);
  return true;
}

// 미디어 프록시도 raw 우회(상단 공통 이유 참고 — VHS가 연 full-stream 응답(예: 41MB itag135)이
// 재생 중 held-open 되면 SSE와 동일 메커니즘으로 OOM).
const PROXY_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const PROXY_CHZZK_REFERER = "https://chzzk.naver.com/";
const HLS_CT = [
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
  "audio/mpegurl",
  "audio/x-mpegurl",
];

function proxyIsHls(streamUrl: string, ct: string | null): boolean {
  if (ct && HLS_CT.some((t) => ct.toLowerCase().includes(t))) return true;
  return streamUrl.split("?")[0].toLowerCase().endsWith(".m3u8");
}
function proxyRewriteM3U8(content: string, baseUrl: string): string {
  const toProxy = (uri: string) =>
    `/api/video/proxy?url=${encodeURIComponent(new URL(uri, baseUrl).toString())}`;
  const attr = /URI="([^"]+)"/g;
  return content
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (t === "") return line;
      if (t.startsWith("#")) {
        attr.lastIndex = 0;
        if (!attr.test(t)) return line;
        attr.lastIndex = 0;
        return line.replace(attr, (_m, uri) => `URI="${toProxy(uri)}"`);
      }
      return toProxy(t);
    })
    .join("\n");
}

async function tryServeProxy(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  query: ParsedUrlQuery,
): Promise<boolean> {
  if (pathname !== "/api/video/proxy") return false;
  const streamUrl = typeof query.url === "string" ? query.url : null;
  if (!streamUrl) return false; // Next 라우트가 400 처리

  const headers: Record<string, string> = {};
  const range = req.headers["range"];
  if (range) headers["Range"] = range;
  try {
    const u = new URL(streamUrl);
    if (u.pathname.includes("/chzzk/") || u.hostname.toLowerCase().includes("naver")) {
      headers["User-Agent"] = PROXY_UA;
      headers["Referer"] = PROXY_CHZZK_REFERER;
    }
  } catch {
    return false;
  }

  let upstream: Response;
  try {
    upstream = await fetch(streamUrl, { headers });
  } catch {
    res.statusCode = 502;
    res.end("proxy fetch failed");
    return true;
  }
  if (!upstream.ok && upstream.status !== 206) {
    res.statusCode = upstream.status;
    res.end();
    return true;
  }

  const ct = upstream.headers.get("content-type");
  if (proxyIsHls(streamUrl, ct)) {
    const text = await upstream.text();
    res.writeHead(200, {
      "content-type": "application/vnd.apple.mpegurl",
      "access-control-allow-origin": "*",
      "cache-control": "no-store",
    });
    res.end(proxyRewriteM3U8(text, streamUrl));
    return true;
  }

  // 바이트 패스스루: Node 스트림 직접 pipe
  const outHeaders: Record<string, string> = { "access-control-allow-origin": "*" };
  for (const k of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(k);
    if (v) outHeaders[k] = v;
  }
  if (!outHeaders["accept-ranges"]) outHeaders["accept-ranges"] = "bytes";
  res.writeHead(upstream.status, outHeaders);
  if (!upstream.body) {
    res.end();
    return true;
  }
  const nodeStream = Readable.fromWeb(upstream.body as NodeWebReadableStream);
  res.on("close", () => nodeStream.destroy());
  nodeStream.on("error", () => {
    if (!res.headersSent) res.statusCode = 502;
    res.end();
  });
  nodeStream.pipe(res);
  return true;
}

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const certsDir = join(__dirname, "certificates");

// 인증서 탐색 우선순위: env > 관례 경로(cert.pem/key.pem) > 레거시(trimvideo.net*.pem).
// entrypoint가 생성한 self-signed cert.pem/key.pem도 이 경로로 자동 인식된다.
const firstExisting = (paths: string[]): string | null =>
  paths.find((p) => p && existsSync(p)) ?? null;

const certPath = firstExisting([
  process.env.TLS_CERT_PATH ?? "",
  join(certsDir, "cert.pem"),
  join(certsDir, "trimvideo.net.pem"),
]);
const keyPath = firstExisting([
  process.env.TLS_KEY_PATH ?? "",
  join(certsDir, "key.pem"),
  join(certsDir, "trimvideo.net-key.pem"),
]);
const useHttps = !!(certPath && keyPath);
const defaultPort = useHttps ? 3443 : 3000;
const port = parseInt(process.env.PORT || String(defaultPort), 10);

const app = next({ dev, hostname, port, turbopack: dev });
const handle = app.getRequestHandler();

// HSTS는 유효 인증서일 때만. self-signed에 보내면 브라우저가 인증서 경고를 하드 차단한다.
// 런타임 토글(ENABLE_HSTS) — next.config는 빌드 타임이라 여기서 처리.
const enableHsts = useHttps && process.env.ENABLE_HSTS === "true";

app
  .prepare()
  .then(() => {
    const handler = async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const parsedUrl = parse(req.url ?? "", true);

        // raw 우회 핸들러 우선 시도(상단 공통 이유 참고). 처리하면 Next로 넘기지 않는다.
        if (parsedUrl.pathname && tryServeProgressSse(req, res, parsedUrl.pathname)) {
          return;
        }
        if (parsedUrl.pathname && tryServeDownload(req, res, parsedUrl.pathname)) {
          return;
        }
        if (
          parsedUrl.pathname &&
          (await tryServeProxy(req, res, parsedUrl.pathname, parsedUrl.query))
        ) {
          return;
        }

        if (enableHsts && !String(req.url || "").startsWith("/api/")) {
          res.setHeader(
            "Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload",
          );
        }
        await handle(req, res, parsedUrl);
      } catch (err: unknown) {
        console.error("[Server] Error handling", req.url, err);
        res.statusCode = 500;
        res.end("internal server error");
      }
    };

    const server = useHttps
      ? createHttpsServer(
          {
            key: readFileSync(keyPath as string),
            cert: readFileSync(certPath as string),
          },
          handler,
        )
      : createHttpServer(handler);

    const protocol = useHttps ? "https" : "http";
    const portSuffix = `:${port}`;

    server
      .once("error", (err: unknown) => {
        console.error(err);
        process.exit(1);
      })
      .listen(port, hostname, () =>
        console.log(`> Ready on ${protocol}://${hostname}${portSuffix}`),
      );
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
