import "server-only";
import { db } from "@/db/client";
import { visits, bills, samples, resultEntries } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, CACHE_TTL } from "@/lib/cache";

async function computeNavBadges(labId: string): Promise<Record<string, number>> {
  // Five independent counts sent as a single libSQL batch (one HTTP request)
  // rather than five separate round-trips.
  const [dues, samplesWaiting, resultsPending, approvalPending, dispatchReady] = await db.batch([
    db
      .select({ n: sql<number>`count(*)` })
      .from(bills)
      .where(and(eq(bills.labId, labId), eq(bills.status, "active"), ne(bills.paymentStatus, "paid"), ne(bills.paymentStatus, "cancelled"))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(samples)
      .where(and(eq(samples.labId, labId), eq(samples.status, "waiting"))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(resultEntries)
      .where(and(eq(resultEntries.labId, labId), sql`${resultEntries.status} in ('pending','draft','correction_required')`)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(resultEntries)
      .where(and(eq(resultEntries.labId, labId), eq(resultEntries.status, "submitted"))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(visits)
      .where(and(eq(visits.labId, labId), eq(visits.status, "approved"))),
  ]);

  return {
    dues: Number(dues[0]?.n ?? 0),
    samples: Number(samplesWaiting[0]?.n ?? 0),
    results: Number(resultsPending[0]?.n ?? 0),
    approval: Number(approvalPending[0]?.n ?? 0),
    dispatch: Number(dispatchReady[0]?.n ?? 0),
  };
}

/**
 * Sidebar badge counts for pending work in each queue.
 *
 * This runs in the app layout, i.e. on EVERY page load, and the dues count
 * alone reads every bill for the lab — so uncached it was one of the largest
 * consumers of Turso row-reads in the system. The numbers are a hint ("there
 * is work over there"), not a record: the queues themselves are never cached,
 * so acting on a badge always lands on live data.
 *
 * Cached for a minute, and flushed after any successful server action, so your
 * own work shows up immediately and only other people's changes can be up to a
 * minute late.
 */
export const getNavBadges = unstable_cache(computeNavBadges, ["nav-badges"], {
  revalidate: CACHE_TTL.ops,
  tags: [CACHE_TAGS.ops],
});
