# syntax=docker/dockerfile:1
# Образ собирается ЛОКАЛЬНО (на сервере 1 CPU/2 ГБ next build не делать):
#   docker build -t zayavki-app:latest .
#   docker save zayavki-app:latest | gzip > zayavki-app.tar.gz   → на сервер → docker load

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# Установка зависимостей
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Сборка приложения + скриптов обслуживания
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
# Миграции, roster:init, create-admin и clear-requests — по одному JS-файлу (без tsx и dev-зависимостей).
RUN npx esbuild db/migrate.ts scripts/init-roster.ts scripts/create-admin.ts scripts/clear-requests.ts \
      --bundle --platform=node --format=esm --target=node22 \
      --outdir=tools --entry-names=[name] --out-extension:.js=.mjs \
      --external:pg-native \
      --banner:js="import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);"

# Рантайм (минимальный standalone-образ)
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Europe/Moscow \
    UPLOAD_DIR=/app/uploads
RUN apk add --no-cache tzdata \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/tools ./tools
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/data/roster.json ./data/roster.json
# Каталог фото (том) и data/ (сюда roster:init пишет credentials.local.csv) — владелец nextjs.
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads /app/data
USER nextjs
EXPOSE 3000
# Миграции при каждом старте (идемпотентно), затем сервер.
CMD ["sh", "-c", "node tools/migrate.mjs && exec node server.js"]
