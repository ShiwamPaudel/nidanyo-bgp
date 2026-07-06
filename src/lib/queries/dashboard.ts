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
import { dayBounds } from "@/lib/datetime";

export async function getDashboardStats(labId: string) {
  const { start, end } = dayBounds();
  const s = Math.floor(start.getTime() / 1000);
  const e = Math.floor(end.getTime() / 1000);

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
  ] = await Promise.all([
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

/** Revenue collected per day for the last N days. */
export async function getRevenueTrend(labId: string, days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const sinceSec = Math.floor(since.getTime() / 1000);

  const rows = await db
    .select({
      day: sql<string>`date(${payments.paidAt}, 'unixepoch', 'localtime')`,
      total: sql<number>`coalesce(sum(${payments.amount}),0)`,
    })
    .from(payments)
    .where(and(eq(payments.labId, labId), ne(payments.kind, "refund"), sql`${payments.paidAt} >= ${sinceSec}`))
    .groupBy(sql`date(${payments.paidAt}, 'unixepoch', 'localtime')`);

  const map = new Map(rows.map((r) => [r.day, Number(r.total)]));
  const out: { day: string; label: string; total: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, label: d.toLocaleDateString("en", { day: "2-digit", month: "short" }), total: map.get(key) ?? 0 });
  }
  return out;
}

/** Most performed tests (all time, top N). */
export async function getTopTests(labId: string, limit = 6) {
  const rows = await db
    .select({ name: visitTests.testName, n: sql<number>`count(*)` })
    .from(visitTests)
    .innerJoin(visits, eq(visitTests.visitId, visits.id))
    .where(and(eq(visits.labId, labId), ne(visitTests.status, "cancelled")))
    .groupBy(visitTests.testName)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows.map((r) => ({ name: r.name, count: Number(r.n) }));
}

/** Collection split by payment mode category for today. */
export async function getCollectionByMode(labId: string) {
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
export async function getPeakHours(labId: string, days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  const rows = await db
    .select({
      hour: sql<string>`strftime('%H', ${visits.visitDate}, 'unixepoch', 'localtime')`,
      n: sql<number>`count(*)`,
    })
    .from(visits)
    .where(and(eq(visits.labId, labId), ne(visits.status, "cancelled"), gte(visits.visitDate, since)))
    .groupBy(sql`strftime('%H', ${visits.visitDate}, 'unixepoch', 'localtime')`);

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
export async function getRevenueByDoctor(labId: string, days = 30, limit = 8) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
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
