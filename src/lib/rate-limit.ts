import "server-only";
import { headers } from "next/headers";
import { db } from "@/db/client";
import { rateLimits } from "@/db/schema";
import { sql } from "drizzle-orm";

export interface RateLimitResult {
  ok: boolean;
  /** Attempts left in the current window (0 once blocked). */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

/**
 * Fixed-window rate limiter backed by the DB.
 *
 * The increment, the window roll-over and the read all happen in ONE statement,
 * so two concurrent requests can never both read a stale count and slip past
 * the limit. Fails OPEN: if the limiter itself errors we let the request
 * through rather than locking everybody out of the app.
 */
export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const next = now + windowSec;
  try {
    const rows = await db.all<{ count: number; expires_at: number }>(sql`
      insert into rate_limits (id, key, count, expires_at, created_at)
      values (${crypto.randomUUID()}, ${key}, 1, ${next}, ${now})
      on conflict(key) do update set
        count      = case when rate_limits.expires_at <= ${now} then 1 else rate_limits.count + 1 end,
        expires_at = case when rate_limits.expires_at <= ${now} then ${next} else rate_limits.expires_at end
      returning count, expires_at
    `);
    const row = rows[0];
    if (!row) return { ok: true, remaining: limit, retryAfter: 0 };
    const count = Number(row.count);
    const expires = Number(row.expires_at);
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfter: Math.max(1, expires - now),
    };
  } catch {
    return { ok: true, remaining: limit, retryAfter: 0 };
  }
}

/** Clear a key's counter — call after a success so good users aren't punished. */
export async function rateLimitReset(key: string): Promise<void> {
  try {
    await db.delete(rateLimits).where(sql`${rateLimits.key} = ${key}`);
  } catch {
    /* non-fatal */
  }
}

/**
 * Best-effort client IP. Trusts x-forwarded-for, which is set by the hosting
 * proxy (Vercel). Falls back to a constant so a missing header degrades to a
 * shared bucket rather than to no limit at all.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip")?.trim() || "unknown";
}

/** Human-friendly "try again in …" text for a retryAfter in seconds. */
export function retryAfterLabel(seconds: number): string {
  if (seconds <= 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const mins = Math.ceil(seconds / 60);
  return `${mins} minute${mins === 1 ? "" : "s"}`;
}
