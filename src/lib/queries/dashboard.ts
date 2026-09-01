import "server-only";
import { db } from "@/db/client";
import {
  patients,
  visits,
  bills,
  payments,
  samples,
  resultEntries,
  visitTests,
  activityLogs,
  resultValues,
} from "@/db/schema";
import { and, eq, gte, lte, sql, desc, ne } from "drizzle-orm";
import { dayBounds, labYmd, labDayBounds, labDaysAgo } from "@/lib/datetime";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS, CACHE_TTL } from "@/lib/cache";

async function computeDashboardStats(labId: string) {
  const { start, end } = dayBounds();
  const s = Math.floor(start.getTime() / 1000);
  const e = Math.floor(end.getTime() / 1000);

  // Ten independent aggregates sent as a single libSQL batch (one HTTP
  // request) instead of ten separate round-trips.
  const [
    todayPatients,
    todayVisits,
    billedAgg,
    collectedAgg,
    dueAgg,
    pendingSamples,
    pendingResults,
    pendingApproval,
    readyDispatch,
    criticalCount,
  ] = await db.batch([
    db
      .select({ n: sql<number>`count(*)` })
      .from(patients)
      .where(and(eq(patients.labId, labId), gte(patients.createdAt, start), lte(patients.createdAt, end))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(visits)
      .where(and(eq(visits.labId, labId), gte(visits.visitDate, start), lte(visits.visitDate, end))),
    db
      .select({ total: sql<number>`coalesce(sum(${bills.grandTotal}),0)`, due: sql<number>`coalesce(sum(${bills.dueAmount}),0)` })
      .from(bills)
      .where(and(eq(bills.labId, labId), eq(bills.status, "active"), gte(bills.createdAt, start), lte(bills.createdAt, end))),
    db
      .select({ total: sql<number>`coalesce(sum(${payments.amount}),0)` })
      .from(payments)
      .where(and(eq(payments.labId, labId), ne(payments.kind, "refund"), sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`)),
    db
      .select({ total: sql<number>`coalesce(sum(${bills.dueAmount}),0)` })
      .from(bills)
      .where(and(eq(bills.labId, labId), eq(bills.status, "active"))),
    db.select({ n: sql<number>`count(*)` }).from(samples).where(and(eq(samples.labId, labId), eq(samples.status, "waiting"))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(resultEntries)
      .where(and(eq(resultEntries.labId, labId), sql`${resultEntries.status} in ('pending','draft','correction_required')`)),
    db.select({ n: sql<number>`count(*)` }).from(resultEntries).where(and(eq(resultEntries.labId, labId), eq(resultEntries.status, "submitted"))),
    db.select({ n: sql<number>`count(*)` }).from(visits).where(and(eq(visits.labId, labId), eq(visits.status, "approved"))),
    db
      .select({ n: sql<number>`count(*)` })
      .from(resultEntries)
      .where(and(eq(resultEntries.labId, labId), eq(resultEntries.hasCritical, true), sql`${resultEntries.status} in ('submitted','approved')`)),
  ]);

  return {
    todayPatients: Number(todayPatients[0]?.n ?? 0),
    todayVisits: Number(todayVisits[0]?.n ?? 0),
    todayBilled: Number(billedAgg[0]?.total ?? 0),
    todayDueGenerated: Number(billedAgg[0]?.due ?? 0),
    todayCollected: Number(collectedAgg[0]?.total ?? 0),
    outstandingDue: Number(dueAgg[0]?.total ?? 0),
    pendingSamples: Number(pendingSamples[0]?.n ?? 0),
    pendingResults: Number(pendingResults[0]?.n ?? 0),
    pendingApproval: Number(pendingApproval[0]?.n ?? 0),
    readyDispatch: Number(readyDispatch[0]?.n ?? 0),
    criticalCount: Number(criticalCount[0]?.n ?? 0),
  };
}

/** Revenue collected per day for the last N days (lab-local days). */
async function computeRevenueTrend(labId: string, days = 14) {
  // Walk back N lab-local days and start at that day's local midnight.
  const todayYmd = labYmd(new Date());
  const anchor = Date.UTC(todayYmd.y, todayYmd.m - 1, todayYmd.d);
  const firstDay = new Date(anchor - (days - 1) * 86400000);
  const { start: since } = labDayBounds(
    firstDay.getUTCFullYear(),
    firstDay.getUTCMonth() + 1,
    firstDay.getUTCDate(),
  );
  const sinceSec = Math.floor(since.getTime() / 1000);

  const rows = await db
    .select({
      // '+5 hours','+45 minutes' — NOT 'localtime': this runs on Turso's server,
      // which is UTC, so 'localtime' silently grouped payments into UTC days.
      day: sql<string>`date(${payments.paidAt}, 'unixepoch', '+5 hours', '+45 minutes')`,
      total: sql<number>`coalesce(sum(${payments.amount}),0)`,
    })
    .from(payments)
    .where(and(eq(payments.labId, labId), ne(payments.kind, "refund"), sql`${payments.paidAt} >= ${sinceSec}`))
    .groupBy(sql`date(${payments.paidAt}, 'unixepoch', '+5 hours', '+45 minutes')`);

  const map = new Map(rows.map((r) => [r.day, Number(r.total)]));
  const out: { day: string; label: string; total: number }[] = [];
  for (let i = 0; i < days; i++) {
    // Keys must be lab-local calendar days to match what SQL now groups by.
    const d = new Date(anchor - (days - 1 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    out.push({
      day: key,
      label: `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]}`,
      total: map.get(key) ?? 0,
    });
  }
  return out;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Most performed tests (all time, top N). Tests ordered inside a profile/panel
 * are counted as the profile (CBC, Lipid Profile…), not as their individual
 * member analytes; standalone tests count on their own. "Count" is distinct
 * visits the item was performed in.
 */
async function computeTopTests(labId: string, limit = 6) {
  const keyExpr = sql`coalesce(${visitTests.groupId}, ${visitTests.testId})`;
  const rows = await db
    .select({
      name: sql<string>`coalesce(${visitTests.groupName}, ${visitTests.testName})`,
      kind: sql<string>`case when ${visitTests.groupId} is not null then 'group' else 'test' end`,
      n: sql<number>`count(distinct ${visitTests.visitId})`,
    })
    .from(visitTests)
    .innerJoin(visits, eq(visitTests.visitId, visits.id))
    .where(and(eq(visits.labId, labId), ne(visitTests.status, "cancelled")))
    .groupBy(keyExpr)
    .orderBy(desc(sql`count(distinct ${visitTests.visitId})`))
    .limit(limit);
  return rows.map((r) => ({ name: r.name, kind: r.kind === "group" ? ("group" as const) : ("test" as const), count: Number(r.n) }));
}

/** Collection split by payment mode category for today. */
async function computeCollectionByMode(labId: string) {
  const { start, end } = dayBounds();
  const s = Math.floor(start.getTime() / 1000);
  const e = Math.floor(end.getTime() / 1000);
  const rows = await db
    .select({ mode: payments.mode, total: sql<number>`coalesce(sum(${payments.amount}),0)` })
    .from(payments)
    .where(and(eq(payments.labId, labId), ne(payments.kind, "refund"), sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`))
    .groupBy(payments.mode)
    .orderBy(desc(sql`sum(${payments.amount})`));
  return rows.map((r) => ({ mode: r.mode, total: Number(r.total) }));
}

/** Visit volume by hour of day (busiest hours) over the last N days. */
async function computePeakHours(labId: string, days = 30) {
  const since = labDaysAgo(days);
  const rows = await db
    .select({
      // Shift to Nepal wall-clock before bucketing, or "busiest hour" is 5h45m
      // out — a 7am rush would report as 1am.
      hour: sql<string>`strftime('%H', ${visits.visitDate}, 'unixepoch', '+5 hours', '+45 minutes')`,
      n: sql<number>`count(*)`,
    })
    .from(visits)
    .where(and(eq(visits.labId, labId), ne(visits.status, "cancelled"), gte(visits.visitDate, since)))
    .groupBy(sql`strftime('%H', ${visits.visitDate}, 'unixepoch', '+5 hours', '+45 minutes')`);

  const map = new Map(rows.map((r) => [Number(r.hour), Number(r.n)]));
  // Present a readable working-hours window (6am–9pm) plus rollups.
  const out: { label: string; count: number }[] = [];
  for (let h = 6; h <= 21; h++) {
    const ampm = h < 12 ? "a" : "p";
    const hr = h % 12 === 0 ? 12 : h % 12;
    out.push({ label: `${hr}${ampm}`, count: map.get(h) ?? 0 });
  }
  return out;
}

/** Revenue (billed) grouped by referring doctor over the last N days. */
async function computeRevenueByDoctor(labId: string, days = 30, limit = 8) {
  const since = labDaysAgo(days);
  const rows = await db
    .select({
      doctor: sql<string>`coalesce(nullif(${visits.referredBy}, ''), 'Self / Walk-in')`,
      revenue: sql<number>`coalesce(sum(${bills.grandTotal}),0)`,
      count: sql<number>`count(*)`,
    })
    .from(bills)
    .innerJoin(visits, eq(bills.visitId, visits.id))
    .where(and(eq(bills.labId, labId), eq(bills.status, "active"), gte(bills.createdAt, since)))
    .groupBy(sql`coalesce(nullif(${visits.referredBy}, ''), 'Self / Walk-in')`)
    .orderBy(desc(sql`sum(${bills.grandTotal})`))
    .limit(limit);
  return rows.map((r) => ({ doctor: r.doctor, revenue: Number(r.revenue), count: Number(r.count) }));
}

export async function getRecentActivity(labId: string, limit = 8) {
  return db
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.labId, labId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit);
}

/** Recent critical/abnormal result values for the alert widget. */
export async function getCriticalAlerts(labId: string, limit = 6) {
  return db
    .select({
      label: resultValues.label,
      valueText: resultValues.valueText,
      unit: resultValues.unit,
      flag: resultValues.flag,
      testName: resultEntries.testName,
      visitId: resultEntries.visitId,
      createdAt: resultValues.createdAt,
    })
    .from(resultValues)
    .innerJoin(resultEntries, eq(resultValues.resultEntryId, resultEntries.id))
    .where(and(eq(resultEntries.labId, labId), sql`${resultValues.flag} in ('critical_low','critical_high')`))
    .orderBy(desc(resultValues.createdAt))
    .limit(limit);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Cached entry points.
 *
 * Every dashboard widget below is a glance, not a ledger — the authoritative
 * money screens (Transactions, Financial Reports, Dues) read straight from the
 * database and are never cached. See src/lib/cache.ts for the policy.
 *
 * `getRecentActivity` and `getCriticalAlerts` are intentionally left uncached:
 * they read a handful of indexed rows, so there is nothing to save.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Today's counters + outstanding dues. Flushed after any successful action. */
export const getDashboardStats = unstable_cache(computeDashboardStats, ["dashboard-stats"], {
  revalidate: CACHE_TTL.ops,
  tags: [CACHE_TAGS.ops],
});

/** Collected per day, last N days. Flushed when money moves. */
export const getRevenueTrend = unstable_cache(computeRevenueTrend, ["revenue-trend"], {
  revalidate: CACHE_TTL.ops,
  tags: [CACHE_TAGS.ops],
});

/** Today's collection split by payment mode. Flushed when money moves. */
export const getCollectionByMode = unstable_cache(computeCollectionByMode, ["collection-by-mode"], {
  revalidate: CACHE_TTL.ops,
  tags: [CACHE_TAGS.ops],
});

/**
 * Most performed tests, all time. The heaviest dashboard query by far — it
 * scans every visit_test the lab has ever recorded and grows forever — and the
 * answer cannot meaningfully change within a working day, so it gets the
 * longest window. Time-based only: flushing it per action would defeat it.
 */
export const getTopTests = unstable_cache(computeTopTests, ["top-tests"], {
  revalidate: CACHE_TTL.topTests,
  tags: [CACHE_TAGS.trends],
});

/** Visit volume by hour over the last 30 days. A shape, not a number. */
export const getPeakHours = unstable_cache(computePeakHours, ["peak-hours"], {
  revalidate: CACHE_TTL.peakHours,
  tags: [CACHE_TAGS.trends],
});

/** Billed revenue by referring doctor over the last 30 days. */
export const getRevenueByDoctor = unstable_cache(computeRevenueByDoctor, ["revenue-by-doctor"], {
  revalidate: CACHE_TTL.revenueByDoctor,
  tags: [CACHE_TAGS.trends],
});
