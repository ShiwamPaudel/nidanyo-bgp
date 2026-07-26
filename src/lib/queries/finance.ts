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
  // Cancelled bills (and cancelled visits, whose bill is marked cancelled too)
  // must never be counted as sales/collection on the report.
  const conds = [eq(payments.labId, labId), ne(bills.status, "cancelled"), sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`];
  if (opts.mode && opts.mode !== "all") conds.push(eq(payments.mode, opts.mode));
  if (term) conds.push(or(like(payments.code, term), like(bills.code, term), like(visits.code, term), like(patients.fullName, term))!);

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
      billCreatedAt: bills.createdAt,
      visitId: bills.visitId,
      visitCode: visits.code,
      patientName: patients.fullName,
      // Who referred the patient for this visit — the visit's referral wins,
      // falling back to the patient's default referrer. Used to track walk-ins
      // vs. doctor-referred patients on finance reports.
      visitReferredBy: visits.referredBy,
      patientReferredBy: patients.referredBy,
    })
    .from(payments)
    .innerJoin(bills, eq(payments.billId, bills.id))
    .innerJoin(patients, eq(payments.patientId, patients.id))
    .innerJoin(visits, eq(bills.visitId, visits.id))
    .where(and(...conds))
    .orderBy(desc(payments.paidAt))
    .limit(1000);

  const shaped = rows.map(({ visitReferredBy, patientReferredBy, ...r }) => ({
    ...r,
    referredBy: visitReferredBy ?? patientReferredBy ?? null,
  }));
  const total = shaped.reduce((sum, r) => sum + (r.kind === "refund" ? -r.amount : r.amount), 0);

  // Split collections into (a) money against bills raised within this same
  // range — the day's own sales & due settlements — and (b) dues settled today
  // against bills raised on an EARLIER day. A payment belongs to the "previous
  // days" bucket when its bill was created before the range starts.
  const sumNet = (list: typeof shaped) => list.reduce((acc, r) => acc + (r.kind === "refund" ? -r.amount : r.amount), 0);
  const isSameDayBill = (r: (typeof shaped)[number]) => {
    const created = Math.floor((r.billCreatedAt?.getTime() ?? 0) / 1000);
    return created >= s;
  };
  const dayRows = shaped.filter(isSameDayBill);
  const dueRows = shaped.filter((r) => !isSameDayBill(r));

  return {
    rows: shaped,
    total,
    dayRows,
    dayTotal: sumNet(dayRows),
    dueRows,
    dueTotal: sumNet(dueRows),
  };
}

/**
 * Sales raised within a date range — one row per bill, keyed on the BILL date,
 * independent of whether/when it was collected.
 *
 * This is the accrual view: a visit billed today is a sale today, even if the
 * money arrives tomorrow (or never). A bill billed today but paid tomorrow would
 * be invisible on a payment-driven list — which is why the day's sales must come
 * from here. Cancelled bills are excluded.
 *
 * `collected` is what was received against the bill WITHIN this period — the
 * day's own takings, so cash reconciliation for that day never moves.
 * `settledLater` is what came in against the same bill AFTER the period (a due
 * cleared on a later day), and `due` is what is STILL outstanding today
 * (`bills.dueAmount`, kept current by `recomputeBill`). So re-exporting the day
 * a bill was raised shows no due once the patient has settled it, while the
 * money itself still belongs to the day it was actually collected — it appears
 * in that later day's "previous days' dues" table, never double-counted here.
 *
 * Barring refunds, Collected + Settled later + Due = Net sales for every row.
 */
export async function getSalesInRange(labId: string, from?: string, to?: string) {
  const { s, e, start, end } = dayRange(from, to);
  // Money received against each bill inside this period (refunds subtracted).
  const paidInRange = db
    .select({
      billId: payments.billId,
      collected: sql<number>`coalesce(sum(case when ${payments.kind} = 'refund' then -${payments.amount} else ${payments.amount} end),0)`.as("collected"),
    })
    .from(payments)
    .where(and(sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`))
    .groupBy(payments.billId)
    .as("paid_in_range");

  // …and what came in against it after this period closed. A bill raised in the
  // range has no payments before it, so in-range + after-range is everything
  // ever collected on it.
  const paidAfterRange = db
    .select({
      billId: payments.billId,
      collectedAfter: sql<number>`coalesce(sum(case when ${payments.kind} = 'refund' then -${payments.amount} else ${payments.amount} end),0)`.as("collected_after"),
    })
    .from(payments)
    .where(sql`${payments.paidAt} > ${e}`)
    .groupBy(payments.billId)
    .as("paid_after_range");

  const rows = await db
    .select({
      billCode: bills.code,
      visitCode: visits.code,
      createdAt: bills.createdAt,
      patientName: patients.fullName,
      visitReferredBy: visits.referredBy,
      patientReferredBy: patients.referredBy,
      subtotal: bills.subtotal,
      discount: bills.discountAmount,
      tax: bills.taxAmount,
      grandTotal: bills.grandTotal,
      collected: sql<number>`coalesce(${paidInRange.collected}, 0)`,
      settledLater: sql<number>`coalesce(${paidAfterRange.collectedAfter}, 0)`,
      // Live outstanding — not "grand total minus what this period collected",
      // so a due cleared on a later day reads as settled here too.
      dueNow: bills.dueAmount,
    })
    .from(bills)
    .innerJoin(visits, eq(bills.visitId, visits.id))
    .innerJoin(patients, eq(bills.patientId, patients.id))
    .leftJoin(paidInRange, eq(paidInRange.billId, bills.id))
    .leftJoin(paidAfterRange, eq(paidAfterRange.billId, bills.id))
    .where(and(eq(bills.labId, labId), eq(bills.status, "active"), gte(bills.createdAt, start), lte(bills.createdAt, end)))
    .orderBy(desc(bills.createdAt))
    .limit(2000);

  const shaped = rows.map(({ visitReferredBy, patientReferredBy, collected, settledLater, dueNow, ...r }) => ({
    ...r,
    referredBy: visitReferredBy ?? patientReferredBy ?? null,
    collected: Number(collected),
    settledLater: Number(settledLater),
    due: Math.max(0, Number(dueNow ?? 0)),
  }));
  const totals = shaped.reduce(
    (t, r) => ({
      gross: t.gross + r.subtotal,
      discount: t.discount + r.discount,
      tax: t.tax + r.tax,
      net: t.net + r.grandTotal,
      collected: t.collected + r.collected,
      settledLater: t.settledLater + r.settledLater,
      due: t.due + r.due,
    }),
    { gross: 0, discount: 0, tax: 0, net: 0, collected: 0, settledLater: 0, due: 0 },
  );
  return { rows: shaped, totals };
}

/** End-of-day / range financial summary. */
export async function getEodSummary(labId: string, from?: string, to?: string) {
  const { s, e, start, end } = dayRange(from, to);

  const [collectAgg, byMode, byUser, billAgg, discountAgg] = await Promise.all([
    // Payments on cancelled bills are never counted as collection — a cancelled
    // visit is off the books, same as it's excluded from the transactions table.
    db
      .select({
        collected: sql<number>`coalesce(sum(case when ${payments.kind} != 'refund' then ${payments.amount} else 0 end),0)`,
        refunded: sql<number>`coalesce(sum(case when ${payments.kind} = 'refund' then ${payments.amount} else 0 end),0)`,
        dueCollected: sql<number>`coalesce(sum(case when ${payments.kind} = 'due_collection' then ${payments.amount} else 0 end),0)`,
      })
      .from(payments)
      .innerJoin(bills, eq(payments.billId, bills.id))
      .where(and(eq(payments.labId, labId), ne(bills.status, "cancelled"), sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`)),
    db
      .select({ mode: payments.mode, total: sql<number>`coalesce(sum(${payments.amount}),0)` })
      .from(payments)
      .innerJoin(bills, eq(payments.billId, bills.id))
      .where(and(eq(payments.labId, labId), ne(bills.status, "cancelled"), ne(payments.kind, "refund"), sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`))
      .groupBy(payments.mode)
      .orderBy(desc(sql`sum(${payments.amount})`)),
    db
      .select({ user: payments.receivedByName, total: sql<number>`coalesce(sum(${payments.amount}),0)`, count: sql<number>`count(*)` })
      .from(payments)
      .innerJoin(bills, eq(payments.billId, bills.id))
      .where(and(eq(payments.labId, labId), ne(bills.status, "cancelled"), ne(payments.kind, "refund"), sql`${payments.paidAt} >= ${s}`, sql`${payments.paidAt} <= ${e}`))
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
      .where(and(eq(bills.labId, labId), eq(bills.status, "active"), gte(bills.createdAt, start), lte(bills.createdAt, end))),
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

/**
 * Test-wise revenue & frequency for a range.
 *
 * Tests ordered as part of a profile/panel (CBC, Lipid Profile…) are rolled up
 * under the group so the report shows the profile's overall performance instead
 * of every member analyte on its own row. Standalone tests stay as individual
 * rows. "Times" counts distinct visits the item was performed in.
 */
export async function getTestRevenue(labId: string, from?: string, to?: string) {
  const { start, end } = dayRange(from, to);
  // Group by the profile when present, otherwise by the test itself.
  const keyExpr = sql`coalesce(${visitTests.groupId}, ${visitTests.testId})`;
  const rows = await db
    .select({
      kind: sql<string>`case when ${visitTests.groupId} is not null then 'group' else 'test' end`,
      name: sql<string>`coalesce(${visitTests.groupName}, ${visitTests.testName})`,
      count: sql<number>`count(distinct ${visitTests.visitId})`,
      revenue: sql<number>`coalesce(sum(${visitTests.price}),0)`,
    })
    .from(visitTests)
    .innerJoin(visits, eq(visitTests.visitId, visits.id))
    .where(and(eq(visits.labId, labId), ne(visitTests.status, "cancelled"), gte(visits.visitDate, start), lte(visits.visitDate, end)))
    .groupBy(keyExpr)
    .orderBy(desc(sql`sum(${visitTests.price})`))
    .limit(100);
  return rows.map((r) => ({
    name: r.name,
    kind: r.kind === "group" ? ("group" as const) : ("test" as const),
    count: Number(r.count),
    revenue: Number(r.revenue),
  }));
}

export async function getOutstandingDuesTotal(labId: string) {
  const r = await db
    .select({ total: sql<number>`coalesce(sum(${bills.dueAmount}),0)`, count: sql<number>`count(*)` })
    .from(bills)
    .where(and(eq(bills.labId, labId), eq(bills.status, "active"), sql`${bills.dueAmount} > 0`));
  return { total: Number(r[0]?.total ?? 0), count: Number(r[0]?.count ?? 0) };
}
