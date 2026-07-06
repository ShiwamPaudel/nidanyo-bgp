import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load .env.local first (takes precedence, mirrors Next.js), then .env fills gaps.
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL || "file:local.db",
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  },
  verbose: true,
  strict: true,
});
