import "dotenv/config";
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  // This `url` is what the Prisma CLI uses for `migrate`/`generate`/
  // `introspect` — NOT what the running app queries with (the app's
  // PrismaClient uses its own @prisma/adapter-neon connection straight off
  // DATABASE_URL, see src/lib/prisma.ts, entirely bypassing this file).
  // It must be Neon's DIRECT (non-pooled) connection string: Neon's pooled
  // "-pooler" endpoint runs PgBouncer in transaction mode, which can't hold
  // the session-scoped advisory lock `prisma migrate deploy` takes before
  // running DDL — pointing this at the pooled URL is exactly what caused
  // migrate deploy to fail with P1002 ("Timed out trying to acquire a
  // postgres advisory lock"). Set DIRECT_URL (same Neon project/db, just the
  // host without "-pooler") wherever migrations run — Vercel's env vars and
  // your local .env.
  datasource: {
    url: env("DIRECT_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
