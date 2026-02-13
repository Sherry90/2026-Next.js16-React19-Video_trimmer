const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Next.js app 준비
const app = next({ dev, hostname, port, turbopack: dev });
const handle = app.getRequestHandler();

console.log('[Server] Preparing Next.js...');

app.prepare().then(() => {
  console.log('[Server] Next.js ready, creating HTTP server...');

  // HTTP 서버 생성
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[Server] Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Socket.IO 서버 통합
  console.log('[Server] Initializing Socket.IO...');
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? [`http://localhost:${port}`, `http://127.0.0.1:${port}`] : false,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
  });

  console.log('[Server] Loading Socket.IO handlers...');
  // Socket.IO handlers 로드
  require('./src/lib/socketHandlers')(io);

  httpServer
    .once('error', (err) => {
      console.error('[Server] HTTP server error:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server initialized`);
    });
}).catch((err) => {
  console.error('[Server] Failed to prepare Next.js:', err);
  process.exit(1);
});
