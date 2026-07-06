import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { assetBlobs } from "@/db/schema";

/**
 * Storage adapter — provider-agnostic. The app uploads via `storage.put()` and
 * stores the returned { key, url }. Switching providers is a config change.
 *
 * Implemented now:
 *  - "db"    — stores bytes in the asset_blobs table, served by /api/asset/[key].
 *              Works on any host (serverless/read-only/ephemeral fs safe). Default.
 *  - "local" — writes to /public/uploads, served by Next. Dev / single-server only;
 *              fails on read-only or ephemeral production filesystems.
 * Stubs documented for supabase / r2 — wire up credentials in env and implement
 * the corresponding branch.
 */

export interface StoredFile {
  key: string;
  url: string;
}

export interface StorageAdapter {
  put(input: {
    data: Buffer;
    filename: string;
    contentType?: string;
    folder?: string;
  }): Promise<StoredFile>;
  remove(key: string): Promise<void>;
}

const PROVIDER = process.env.STORAGE_PROVIDER || "db";

/**
 * Database adapter — stores bytes in the asset_blobs table. Host-agnostic:
 * no filesystem writes, so it works on serverless and read-only/ephemeral
 * production environments where the "local" adapter fails.
 */
const dbAdapter: StorageAdapter = {
  async put({ data, filename, contentType }) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${randomUUID()}-${safe}`;
    await db.insert(assetBlobs).values({
      key,
      data,
      mimeType: contentType ?? null,
      size: data.length,
    });
    return { key, url: `/api/asset/${encodeURIComponent(key)}` };
  },
  async remove(key) {
    await db.delete(assetBlobs).where(eq(assetBlobs.key, key));
  },
};

/** Local filesystem adapter (development / single-server fallback). */
const localAdapter: StorageAdapter = {
  async put({ data, filename, folder }) {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const sub = folder ? folder.replace(/[^a-zA-Z0-9/_-]/g, "") : "misc";
    const dir = path.join(process.cwd(), "public", "uploads", sub);
    await fs.mkdir(dir, { recursive: true });
    const key = `${sub}/${randomUUID()}-${safe}`;
    const full = path.join(process.cwd(), "public", "uploads", key);
    await fs.writeFile(full, data);
    return { key, url: `/uploads/${key}` };
  },
  async remove(key) {
    try {
      await fs.unlink(path.join(process.cwd(), "public", "uploads", key));
    } catch {
      /* ignore missing */
    }
  },
};

function resolveAdapter(): StorageAdapter {
  switch (PROVIDER) {
    case "db":
      return dbAdapter;
    case "local":
      return localAdapter;
    // case "supabase": return supabaseAdapter;  // TODO: implement with SUPABASE_* env
    // case "r2": return r2Adapter;                 // TODO
    default:
      // Unknown provider configured — fall back to db (host-agnostic) rather than crashing.
      return dbAdapter;
  }
}

export const storage = resolveAdapter();
