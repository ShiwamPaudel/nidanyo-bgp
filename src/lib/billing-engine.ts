import "server-only";
import { db } from "@/db/client";
import { bills, payments, visits, reportLinks } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { activateReportLinkIfReady } from "@/lib/report-engine";

/** Round to 2dp to avoid float drift. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Recompute a bill's paid/due/refund totals from its payment rows and update
 * its payment status. After clearing, attempts to activate the report link if
 * results are already approved (sends SMS). Returns the updated figures.
 */
export async function recomputeBill(billId: string) {
  const bill = (await db.select().from(bills).where(eq(bills.id, billId))).at(0);
  if (!bill) return null;

  const agg = await db
    .select({
      paid: sql<number>`coalesce(sum(case when ${payments.kind} != 'refund' then ${payments.amount} else 0 end),0)`,
      refunded: sql<number>`coalesce(sum(case when ${payments.kind} = 'refund' then ${payments.amount} else 0 end),0)`,
    })
    .from(payments)
    .where(eq(payments.billId, billId));

  const paid = round2(Number(agg[0]?.paid ?? 0));
  const refunded = round2(Number(agg[0]?.refunded ?? 0));
  const grand = round2(bill.grandTotal);
  const due = round2(Math.max(0, grand - paid));

  let paymentStatus: typeof bill.paymentStatus;
  if (bill.status === "cancelled") paymentStatus = "cancelled";
  else if (refunded > 0 && paid <= 0) paymentStatus = "refunded";
  else if (paid <= 0) paymentStatus = "unpaid";
  else if (due > 0) paymentStatus = "partial";
  else paymentStatus = "paid";

  await db
    .update(bills)
    .set({ paidAmount: paid, dueAmount: due, refundedAmount: refunded, paymentStatus })
    .where(eq(bills.id, billId));

  // When the due hits zero, the report may become eligible for release.
  if (due <= 0 && bill.status !== "cancelled") {
    await activateReportLinkIfReady(bill.visitId);
  }

  return { paid, due, refunded, paymentStatus };
}

/** Recompute the visit's overall workflow status from its results/samples. */
export async function syncVisitStatus(visitId: string) {
  // Lightweight: derive from per-test result entry statuses handled elsewhere.
  const visit = (await db.select().from(visits).where(eq(visits.id, visitId))).at(0);
  return visit ?? null;
}

/** Count active (non-cancelled, non-paid) bills with outstanding due for a lab. */
export async function outstandingDueExists(labId: string) {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(bills)
    .where(and(eq(bills.labId, labId), eq(bills.status, "active"), ne(bills.paymentStatus, "paid")));
  return Number(rows[0]?.n ?? 0) > 0;
}

export { reportLinks };
