import { createServer } from 'https';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Next.js app 준비
const app = next({ dev, hostname, port, turbopack: dev });
const handle = app.getRequestHandler();

console.log('[Server] Preparing Next.js...');

app.prepare().then(() => {
  console.log('[Server] Next.js ready, creating HTTPS server...');

  // HTTPS 인증서 로드
  const httpsOptions = {
    key: readFileSync(join(process.cwd(), 'certificates', 'localhost-key.pem')),
    cert: readFileSync(join(process.cwd(), 'certificates', 'localhost.pem')),
  };

  // HTTPS 서버 생성
  const httpsServer = createServer(httpsOptions, async (req: any, res: any) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err: any) {
      console.error('[Server] Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Socket.IO 서버 통합
  console.log('[Server] Initializing Socket.IO...');
  const io = new Server(httpsServer, {
    cors: {
      origin: dev ? [`https://localhost:${port}`, `https://127.0.0.1:${port}`] : false,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  console.log('[Server] Loading Socket.IO handlers...');
  // Socket.IO handlers 로드
  import('./src/lib/socketHandlers').then((mod) => {
    mod.default(io);
    console.log('> Socket.IO server initialized');
  });

  httpsServer
    .once('error', (err: any) => {
      console.error('[Server] HTTPS server error:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on https://${hostname}:${port}`);
      console.log(`> Socket.IO server initialized`);
    });
}).catch((err: any) => {
  console.error('[Server] Failed to prepare Next.js:', err);
  process.exit(1);
});
