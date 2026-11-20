// Импортировать ПЕРВЫМ в каждом тесте с БД: база PGlite в памяти, никакого DATABASE_URL.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

delete process.env.DATABASE_URL;
process.env.PGLITE_PATH = "memory://";
process.env.UPLOAD_DIR = mkdtempSync(path.join(tmpdir(), "zayavki-test-uploads-"));
