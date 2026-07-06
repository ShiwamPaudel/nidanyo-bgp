import "server-only";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

/**
 * Single shared libSQL/Turso connection. For local dev DATABASE_URL is
 * "file:local.db"; for production it is a libsql:// URL with an auth token.
 */
const globalForDb = globalThis as unknown as {
  __nidanyoLibsql?: ReturnType<typeof createClient>;
};

const libsql =
  globalForDb.__nidanyoLibsql ??
  createClient({
    url: process.env.DATABASE_URL || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__nidanyoLibsql = libsql;
}

export const db = drizzle(libsql, { schema });
export { schema };
export type DB = typeof db;
