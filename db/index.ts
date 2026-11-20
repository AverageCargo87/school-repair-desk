import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * Драйвер БД: если задан DATABASE_URL — настоящий PostgreSQL (прод),
 * иначе встроенный PGlite. Путь PGlite — PGLITE_PATH (по умолчанию `.pgdata`);
 * `PGLITE_PATH=memory://` — база в памяти (тесты).
 */
export const dbDriver: "pg" | "pglite" = process.env.DATABASE_URL
  ? "pg"
  : "pglite";

export type DB = NodePgDatabase<typeof schema>;
/** Транзакция drizzle (то, что приходит в колбэк db.transaction). */
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
/** Любой исполнитель запросов: сама база или транзакция. */
export type DbOrTx = DB | Tx;

const globalForDb = globalThis as unknown as { __zayavkiDb?: DB };

function createDb(): DB {
  if (dbDriver === "pg") {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return drizzlePg(pool, { schema });
  }
  const path = process.env.PGLITE_PATH || ".pgdata";
  const client = path === "memory://" ? new PGlite() : new PGlite(path);
  return drizzlePglite(client, { schema }) as unknown as DB;
}

export function getDb(): DB {
  return (globalForDb.__zayavkiDb ??= createDb());
}

// Lazy proxy: the underlying database (PGlite/pg) is created only on first
// real query, not merely when this module is imported. This keeps build-time
// static analysis from spinning up PGlite in worker processes.
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const inst = getDb() as unknown as Record<string | symbol, unknown>;
    const value = inst[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(inst)
      : value;
  },
});

export { schema };
