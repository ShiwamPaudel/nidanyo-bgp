import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Storage adapter — provider-agnostic. The app uploads via `storage.put()` and
 * stores the returned { key, url }. Switching providers is a config change.
 *
 * Implemented now: "local" (writes to /public/uploads, served by Next).
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

const PROVIDER = process.env.STORAGE_PROVIDER || "local";

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
    case "local":
      return localAdapter;
    // case "supabase": return supabaseAdapter;  // TODO: implement with SUPABASE_* env
    // case "r2": return r2Adapter;                 // TODO
    default:
      // Unknown provider configured — fall back to local rather than crashing.
      return localAdapter;
  }
}

export const storage = resolveAdapter();
