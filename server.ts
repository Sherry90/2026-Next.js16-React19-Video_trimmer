import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const certsDir = join(__dirname, 'certificates');

// 인증서 탐색 우선순위: env > 관례 경로(cert.pem/key.pem) > 레거시(trimvideo.net*.pem).
// entrypoint가 생성한 self-signed cert.pem/key.pem도 이 경로로 자동 인식된다.
const firstExisting = (paths: string[]): string | null =>
  paths.find((p) => p && existsSync(p)) ?? null;

const certPath = firstExisting([
  process.env.TLS_CERT_PATH ?? '',
  join(certsDir, 'cert.pem'),
  join(certsDir, 'trimvideo.net.pem'),
]);
const keyPath = firstExisting([
  process.env.TLS_KEY_PATH ?? '',
  join(certsDir, 'key.pem'),
  join(certsDir, 'trimvideo.net-key.pem'),
]);
const useHttps = !!(certPath && keyPath);
const defaultPort = useHttps ? 3443 : 3000;
const port = parseInt(process.env.PORT || String(defaultPort), 10);

const app = next({ dev, hostname, port, turbopack: dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const handler = async (req: any, res: any) => {
    try {
      await handle(req, res, parse(req.url, true));
    } catch (err: any) {
      console.error('[Server] Error handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  };

  const server = useHttps
    ? createHttpsServer({
        key: readFileSync(keyPath as string),
        cert: readFileSync(certPath as string),
      }, handler)
    : createHttpServer(handler);

  const protocol = useHttps ? 'https' : 'http';
  const portSuffix = `:${port}`;

  server
    .once('error', (err: any) => { console.error(err); process.exit(1); })
    .listen(port, hostname, () => console.log(`> Ready on ${protocol}://${hostname}${portSuffix}`));
}).catch((err: any) => { console.error(err); process.exit(1); });
