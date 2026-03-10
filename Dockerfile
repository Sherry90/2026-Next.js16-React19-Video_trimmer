FROM node:22-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1 \
    HTTPS=false \
    SKIP_OPTIONAL_BINARY_DOWNLOADS=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    ffmpeg \
    python3 \
    python3-pip \
  && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --timeout 60 yt-dlp streamlink

FROM base AS deps

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM deps AS builder

COPY . .
RUN npm run build

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
