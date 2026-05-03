import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse } from 'url';
import next from 'next';

const dev = process.env.NODE_ENV !== 'production';
const hostname = dev ? 'localhost' : '0.0.0.0';
const certsDir = join(__dirname, 'certificates');
const useHttps = existsSync(join(certsDir, 'trimvideo.net-key.pem'))
  && existsSync(join(certsDir, 'trimvideo.net.pem'));
const defaultPort = useHttps ? 443 : 3000;
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
        key: readFileSync(join(certsDir, 'trimvideo.net-key.pem')),
        cert: readFileSync(join(certsDir, 'trimvideo.net.pem')),
      }, handler)
    : createHttpServer(handler);

  const protocol = useHttps ? 'https' : 'http';
  const portSuffix = (useHttps && port === 443) || (!useHttps && port === 80) ? '' : `:${port}`;

  server
    .once('error', (err: any) => { console.error(err); process.exit(1); })
    .listen(port, hostname, () => console.log(`> Ready on ${protocol}://${hostname}${portSuffix}`));
}).catch((err: any) => { console.error(err); process.exit(1); });
