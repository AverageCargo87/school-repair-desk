import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "exceljs"],
  output: "standalone",
  outputFileTracingRoot: rootDir,
  turbopack: { root: rootDir },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Запрет встраивания в чужие сайты (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // Токен из /t/[token] не уходит во внешний Referer.
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Фото: до 5 шт. по ≤ 8 МБ (обычно после сжатия на клиенте ~300 КБ) + запас
      // на multipart. По умолчанию Next режет тело server action на 1 МБ.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
