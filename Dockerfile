# syntax=docker/dockerfile:1

# ── base: 런타임/빌드 공통 베이스 + 외부 바이너리 (ffmpeg, yt-dlp, streamlink, openssl) ──
# 프로젝트가 로컬에서 쓰는 바이너리를 이미지에 내장한다. binPaths.ts의 system 폴백 경로로
# 해석된다(ffmpeg: @ffmpeg-installer 우선 → apt, yt-dlp/streamlink: system `which`).
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      ffmpeg \
      aria2 \
      python3 \
      python3-pip \
      openssl \
  && pip3 install --break-system-packages --timeout 60 yt-dlp streamlink \
  && apt-get purge -y python3-pip \
  && apt-get autoremove -y \
  && rm -rf /var/lib/apt/lists/*

# ── deps: 전체 의존성 설치 (빌드용). package*.json 미변경 시 레이어 캐시 재사용 ──
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

# ── builder: Next 빌드 + server.ts 컴파일 ──
FROM deps AS builder
COPY . .
# prebuild(copy-wasm.mjs)가 public/ffmpeg로 wasm 복사 후 next build
RUN npm run build
# server.ts를 tsx 없이 실행하려고 단일 cjs로 번들 (next/node_modules는 런타임 external)
RUN npx --no-install esbuild server.ts \
      --bundle --platform=node --target=node22 --packages=external \
      --outfile=server.cjs

# ── prod-deps: 런타임 prod 의존성만 (slim) ──
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts

# ── runner: 최종 이미지 ──
FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3443
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder   /app/.next ./.next
COPY --from=builder   /app/public ./public
COPY --from=builder   /app/server.cjs ./server.cjs
COPY package.json ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# @ffmpeg-installer의 정적 ffmpeg는 컨테이너에서 DNS 해석 불가("Failed to resolve hostname").
# 제거해 getFfmpegPath()가 시스템 ffmpeg(apt, DNS 정상)로 폴백하게 한다. (서버 트림 필수)
RUN rm -rf /app/node_modules/@ffmpeg-installer \
  && chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /app/certificates \
  && chown -R node:node /app

# 비루트 실행 (3443은 비특권 포트라 바인드 가능)
USER node
EXPOSE 3443
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.cjs"]
