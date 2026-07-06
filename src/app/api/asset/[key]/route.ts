import { db } from "@/db/client";
import { assetBlobs } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * Serves an uploaded asset's bytes from the asset_blobs table (STORAGE_PROVIDER="db").
 * Keys are random UUIDs and content is immutable, so responses cache aggressively.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const row = (
    await db.select().from(assetBlobs).where(eq(assetBlobs.key, decodeURIComponent(key)))
  ).at(0);
  if (!row) return new Response("Not found", { status: 404 });

  const bytes = new Uint8Array(row.data);
  return new Response(bytes, {
    headers: {
      "Content-Type": row.mimeType || "application/octet-stream",
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
