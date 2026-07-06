import { config } from "dotenv";
// Load .env.local first (takes precedence, mirrors Next.js), then .env fills gaps.
config({ path: ".env.local" });
config({ path: ".env" });
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";

/**
 * Applies generated SQL migrations from ./drizzle to the configured database.
 * Run after `npm run db:generate`. For quick local dev you can also use
 * `npm run db:push` to sync the schema without migration files.
 */
async function main() {
  const client = createClient({
    url: process.env.DATABASE_URL || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  });
  const db = drizzle(client);
  console.log("Applying migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
  client.close();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});