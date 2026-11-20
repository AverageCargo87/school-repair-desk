#!/bin/bash
# Локальная упаковка для выкладки без Docker на этой машине:
#   bash deploy/pack.sh   →  deploy/out/zayavki-bundle.tgz (Dockerfile + app/)
# На сервере: tar xzf zayavki-bundle.tgz && docker build -t zayavki-app:latest .
# Сборку (npm run build) делать заранее: скрипт берёт готовую .next/standalone.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=deploy/out
[ -f .next/standalone/server.js ] || { echo "Нет .next/standalone — сначала npm run build"; exit 1; }
rm -rf "$OUT" && mkdir -p "$OUT/app"
TOOLS=(db/migrate.ts scripts/init-roster.ts scripts/create-admin.ts)
[ -f scripts/clear-requests.ts ] && TOOLS+=(scripts/clear-requests.ts)
npx esbuild "${TOOLS[@]}" \
  --bundle --platform=node --format=esm --target=node22 \
  --outdir="$OUT/app/tools" --entry-names=[name] --out-extension:.js=.mjs \
  --external:pg-native \
  --banner:js="import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);"
cp -r .next/standalone/. "$OUT/app/"
mkdir -p "$OUT/app/.next" && cp -r .next/static "$OUT/app/.next/static"
cp -r public "$OUT/app/public"
cp -r drizzle "$OUT/app/drizzle"
mkdir -p "$OUT/app/data" && cp data/roster.json "$OUT/app/data/roster.json"
# Никаких локальных баз, фото и паролей в образ.
rm -rf "$OUT/app/.pgdata" "$OUT/app/uploads" "$OUT/app/handover" "$OUT/app/deploy" "$OUT/app/.env" "$OUT/app/.env.local"
find "$OUT/app/data" -name '*.local.*' -delete
cp deploy/Dockerfile.prebuilt "$OUT/Dockerfile"
tar czf "$OUT/zayavki-bundle.tgz" -C "$OUT" Dockerfile app
ls -la "$OUT/zayavki-bundle.tgz"
