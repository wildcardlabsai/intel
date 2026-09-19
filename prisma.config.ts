import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Prisma CLI does not load .env automatically in v7.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

/**
 * Prisma 7 moves connection URLs out of schema.prisma and into this file.
 *
 * This datasource is used by the Prisma CLI only (migrate, db push, studio).
 * Migrate must not run through a connection pooler, so it points at
 * DIRECT_URL — Supabase's unpooled port 5432 connection — falling back to
 * DATABASE_URL for local Postgres where the two are the same.
 *
 * The application itself never reads this file: it connects through the
 * node-postgres driver adapter in src/lib/db/prisma.ts using the pooled
 * DATABASE_URL.
 */
export default defineConfig({
  schema: path.join("prisma", "schema"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: process.env.DIRECT_URL ? env("DIRECT_URL") : env("DATABASE_URL"),
  },
});
