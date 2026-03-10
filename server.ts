import { createServer as createHttpsServer } from 'https';
import { createServer as createHttpServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || process.env.BIND_HOST || (dev ? 'localhost' : '0.0.0.0');
const port = parseInt(process.env.PORT || '3000', 10);
const certKeyPath = process.env.TLS_KEY_PATH || join(process.cwd(), 'certificates', 'trimvideo.com-key.pem');
const certPath = process.env.TLS_CERT_PATH || join(process.cwd(), 'certificates', 'trimvideo.com.pem');

// HTTPS 사용 여부: 인증서 파일이 있고 HTTPS=false가 아닌 경우
const useHttps =
  process.env.HTTPS !== 'false' &&
  existsSync(certKeyPath) &&
  existsSync(certPath);

// Next.js app 준비
const app = next({ dev, hostname, port, turbopack: dev });
const handle = app.getRequestHandler();

const protocol = useHttps ? 'https' : 'http';
console.log(`[Server] Preparing Next.js... (${protocol} mode)`);

app.prepare().then(() => {
  const requestHandler = async (req: any, res: any) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err: any) {
      console.error('[Server] Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  };

  const server = useHttps
    ? createHttpsServer(
        {
          key: readFileSync(certKeyPath),
          cert: readFileSync(certPath),
        },
        requestHandler,
      )
    : createHttpServer(requestHandler);

  server
    .once('error', (err: any) => {
      console.error('[Server] Server error:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on ${protocol}://${hostname}:${port}`);
    });
}).catch((err: any) => {
  console.error('[Server] Failed to prepare Next.js:', err);
  process.exit(1);
});
