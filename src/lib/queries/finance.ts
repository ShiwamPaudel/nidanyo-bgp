import "server-only";
import { db } from "@/db/client";
import { payments, bills, visits, patients, visitTests } from "@/db/schema";
import { and, desc, eq, gte, lte, sql, ne, like, or } from "drizzle-orm";
import { labYmd, labDayBounds, parseLabYmd } from "@/lib/datetime";

/**
 * Resolve "from"/"to" (YYYY-MM-DD) into the exact instants that day begins and
 * ends AT THE LAB.
 *
 * Previously this did `new Date(from)` + `setHours(0,0,0,0)`, which resolved
 * against the *server's* clock (UTC), so an End-of-Day for the 17th actually
 * covered 05:45 on the 17th → 05:44 on the 18th, Nepal time. Cash counted at
 * the counter would not match the report.
 */
function dayRange(from?: string, to?: string) {
  const today = labYmd(new Date());
  const f = (from && parseLabYmd(from)) || today;
  const t = (to && parseLabYmd(to)) || f;
  const { start } = labDayBounds(f.y, f.m, f.d);
  const { end } = labDayBounds(t.y, t.m, t.d);
  return { s: Math.floor(start.getTime() / 1000), e: Math.floor(end.getTime() / 1000), start, end };
}

/** Transactions (payments) within a date range, with optional filters. */
export async function listTransactions(labId: string, opts: { from?: string; to?: string; mode?: string; q?: string } = {}) {
  const { s, e } = dayRange(opts.from, opts.to);
  const term = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const conds = [eq(payments.labId, labId), sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`];
  if (opts.mode && opts.mode !== "all") conds.push(eq(payments.mode, opts.mode));
  if (term) conds.push(or(like(payments.code, term), like(bills.code, term), like(patients.fullName, term))!);

  const rows = await db
    .select({
      id: payments.id,
      code: payments.code,
      paidAt: payments.paidAt,
      amount: payments.amount,
      mode: payments.mode,
      kind: payments.kind,
      reference: payments.reference,
      receivedByName: payments.receivedByName,
      billCode: bills.code,
      visitId: bills.visitId,
      patientName: patients.fullName,
    })
    .from(payments)
    .innerJoin(bills, eq(payments.billId, bills.id))
    .innerJoin(patients, eq(payments.patientId, patients.id))
    .where(and(...conds))
    .orderBy(desc(payments.paidAt))
    .limit(1000);

  const total = rows.reduce((sum, r) => sum + (r.kind === "refund" ? -r.amount : r.amount), 0);
  return { rows, total };
}

/** End-of-day / range financial summary. */
export async function getEodSummary(labId: string, from?: string, to?: string) {
  const { s, e, start, end } = dayRange(from, to);

  const [collectAgg, byMode, byUser, billAgg, discountAgg] = await Promise.all([
    db
      .select({
        collected: sql<number>`coalesce(sum(case when ${payments.kind} != 'refund' then ${payments.amount} else 0 end),0)`,
        refunded: sql<number>`coalesce(sum(case when ${payments.kind} = 'refund' then ${payments.amount} else 0 end),0)`,
        dueCollected: sql<number>`coalesce(sum(case when ${payments.kind} = 'due_collection' then ${payments.amount} else 0 end),0)`,
      })
      .from(payments)
      .where(and(eq(payments.labId, labId), sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`)),
    db
      .select({ mode: payments.mode, total: sql<number>`coalesce(sum(${payments.amount}),0)` })
      .from(payments)
      .where(and(eq(payments.labId, labId), ne(payments.kind, "refund"), sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`))
      .groupBy(payments.mode)
      .orderBy(desc(sql`sum(${payments.amount})`)),
    db
      .select({ user: payments.receivedByName, total: sql<number>`coalesce(sum(${payments.amount}),0)`, count: sql<number>`count(*)` })
      .from(payments)
      .where(and(eq(payments.labId, labId), ne(payments.kind, "refund"), sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`))
      .groupBy(payments.receivedByName)
      .orderBy(desc(sql`sum(${payments.amount})`)),
    db
      .select({
        billed: sql<number>`coalesce(sum(${bills.grandTotal}),0)`,
        dueGenerated: sql<number>`coalesce(sum(${bills.dueAmount}),0)`,
        count: sql<number>`count(*)`,
      })
      .from(bills)
      .where(and(eq(bills.labId, labId), eq(bills.status, "active"), gte(bills.createdAt, start), lte(bills.createdAt, end))),
    db
      .select({ discount: sql<number>`coalesce(sum(${bills.discountAmount}),0)`, cancelled: sql<number>`count(*)` })
      .from(bills)
      .where(and(eq(bills.labId, labId), gte(bills.createdAt, start), lte(bills.createdAt, end))),
  ]);

  const cancelledAgg = await db
    .select({ count: sql<number>`count(*)`, amount: sql<number>`coalesce(sum(${bills.grandTotal}),0)` })
    .from(bills)
    .where(and(eq(bills.labId, labId), eq(bills.status, "cancelled"), gte(bills.createdAt, start), lte(bills.createdAt, end)));

  const cash = byMode.find((m) => /cash/i.test(m.mode))?.total ?? 0;
  const digital = byMode.filter((m) => !/cash|card/i.test(m.mode)).reduce((s2, m) => s2 + Number(m.total), 0);
  const card = byMode.find((m) => /card/i.test(m.mode))?.total ?? 0;

  return {
    range: { start, end },
    billed: Number(billAgg[0]?.billed ?? 0),
    billCount: Number(billAgg[0]?.count ?? 0),
    collected: Number(collectAgg[0]?.collected ?? 0),
    refunded: Number(collectAgg[0]?.refunded ?? 0),
    dueCollected: Number(collectAgg[0]?.dueCollected ?? 0),
    dueGenerated: Number(billAgg[0]?.dueGenerated ?? 0),
    discount: Number(discountAgg[0]?.discount ?? 0),
    cancelledCount: Number(cancelledAgg[0]?.count ?? 0),
    cancelledAmount: Number(cancelledAgg[0]?.amount ?? 0),
    cash: Number(cash),
    digital: Number(digital),
    card: Number(card),
    net: Number(collectAgg[0]?.collected ?? 0) - Number(collectAgg[0]?.refunded ?? 0),
    byMode: byMode.map((m) => ({ mode: m.mode, total: Number(m.total) })),
    byUser: byUser.map((u) => ({ user: u.user ?? "—", total: Number(u.total), count: Number(u.count) })),
  };
}

/** Test-wise revenue & frequency for a range. */
export async function getTestRevenue(labId: string, from?: string, to?: string) {
  const { start, end } = dayRange(from, to);
  const rows = await db
    .select({ name: visitTests.testName, count: sql<number>`count(*)`, revenue: sql<number>`coalesce(sum(${visitTests.price}),0)` })
    .from(visitTests)
    .innerJoin(visits, eq(visitTests.visitId, visits.id))
    .where(and(eq(visits.labId, labId), ne(visitTests.status, "cancelled"), gte(visits.visitDate, start), lte(visits.visitDate, end)))
    .groupBy(visitTests.testName)
    .orderBy(desc(sql`sum(${visitTests.price})`))
    .limit(100);
  return rows.map((r) => ({ name: r.name, count: Number(r.count), revenue: Number(r.revenue) }));
}

export async function getOutstandingDuesTotal(labId: string) {
  const r = await db
    .select({ total: sql<number>`coalesce(sum(${bills.dueAmount}),0)`, count: sql<number>`count(*)` })
    .from(bills)
    .where(and(eq(bills.labId, labId), eq(bills.status, "active"), sql`${bills.dueAmount} > 0`));
  return { total: Number(r[0]?.total ?? 0), count: Number(r[0]?.count ?? 0) };
}
