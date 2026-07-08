import "server-only";
import { db } from "@/db/client";
import { visits, bills, samples, resultEntries } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";

/** Sidebar badge counts for pending work in each queue. */
export async function getNavBadges(labId: string): Promise<Record<string, number>> {
  // Five independent counts sent as a single libSQL batch (one HTTP request)
  // rather than five separate round-trips. Runs on every app page (layout).
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
