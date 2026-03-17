# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    SKIP_OPTIONAL_BINARY_DOWNLOADS=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    python3 \
    python3-pip \
  && pip3 install --break-system-packages --timeout 60 yt-dlp streamlink \
  && apt-get purge -y python3-pip \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

FROM deps AS builder

COPY . .
RUN npm run build \
 && rm -rf .next/standalone/node_modules/@ffmpeg-installer

RUN node - <<'PATCH'
const fs = require('fs');
const serverPath = '.next/standalone/server.js';
const shim = `require('http').createServer = function(opts, listener) {
  if (typeof opts === 'function') { listener = opts; }
  return require('https').createServer({
    key: require('fs').readFileSync(require('path').join(__dirname, 'certificates', 'trimvideo.com-key.pem')),
    cert: require('fs').readFileSync(require('path').join(__dirname, 'certificates', 'trimvideo.com.pem'))
  }, listener);
};
`;
fs.writeFileSync(serverPath, shim + fs.readFileSync(serverPath, 'utf8'));
console.log('[patch] HTTPS shim prepended to server.js');
PATCH

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=443

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 443

CMD ["node", "server.js"]
