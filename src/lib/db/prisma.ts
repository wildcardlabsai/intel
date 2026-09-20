import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 requires a driver adapter; we use node-postgres so the same client
 * works against Supabase's pooled connection (PgBouncer) in production and a
 * local Postgres in development.
 *
 * The client is created lazily on first use rather than at import time. That
 * matters for two reasons: importing a module that happens to touch the
 * database must not require DATABASE_URL to be present (builds and unit tests
 * import these modules without a database), and a missing connection string
 * should fail at the point of the query, with a clear message, rather than at
 * module load.
 *
 * The instance is cached on globalThis so Next.js hot reloading in development
 * does not exhaust the connection pool.
 */

const globalForPrisma = globalThis as unknown as {
  prismaClient: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and set the " +
        "Supabase pooled connection string."
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? [{ level: "warn", emit: "stdout" }, { level: "error", emit: "stdout" }]
        : [{ level: "error", emit: "stdout" }],
  });
}

export function getPrismaClient(): PrismaClient {
  globalForPrisma.prismaClient ??= createClient();
  return globalForPrisma.prismaClient;
}

/**
 * Behaves exactly like a PrismaClient, but defers construction until the first
 * property is read.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client as object, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
  has(_target, property) {
    return Reflect.has(getPrismaClient() as object, property);
  },
});
