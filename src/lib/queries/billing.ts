import "server-only";
import { db } from "@/db/client";
import { visits, bills, patients, visitTests, billItems, payments, samples, reportLinks } from "@/db/schema";
import { and, desc, eq, like, or, sql, gte, lte } from "drizzle-orm";
import { labDayBounds, parseLabYmd } from "@/lib/datetime";

export async function listVisits(
  labId: string,
  opts: { q?: string; status?: string; payment?: string; from?: string; to?: string; page?: number; pageSize?: number } = {},
) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 20;
  const term = opts.q?.trim() ? `%${opts.q.trim()}%` : null;

  const conds = [eq(visits.labId, labId)];
  if (term) conds.push(or(like(visits.code, term), like(patients.fullName, term), like(patients.phone, term), like(bills.code, term))!);
  if (opts.status && opts.status !== "all") conds.push(eq(visits.status, opts.status as never));
  if (opts.payment && opts.payment !== "all") conds.push(eq(bills.paymentStatus, opts.payment as never));
  // Date filters are calendar days at the lab, not on the server's clock.
  const fromYmd = opts.from ? parseLabYmd(opts.from) : null;
  if (fromYmd) conds.push(gte(visits.visitDate, labDayBounds(fromYmd.y, fromYmd.m, fromYmd.d).start));
  const toYmd = opts.to ? parseLabYmd(opts.to) : null;
  if (toYmd) conds.push(lte(visits.visitDate, labDayBounds(toYmd.y, toYmd.m, toYmd.d).end));
  const where = and(...conds);

  const [rows, countRow] = await Promise.all([
    db
      .select({
        id: visits.id,
        code: visits.code,
        status: visits.status,
        priority: visits.priority,
        visitDate: visits.visitDate,
        patientName: patients.fullName,
        patientCode: patients.code,
        patientPhone: patients.phone,
        billCode: bills.code,
        grandTotal: bills.grandTotal,
        paidAmount: bills.paidAmount,
        dueAmount: bills.dueAmount,
        paymentStatus: bills.paymentStatus,
        billStatus: bills.status,
      })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .leftJoin(bills, eq(bills.visitId, visits.id))
      .where(where)
      .orderBy(desc(visits.visitDate))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ n: sql<number>`count(*)` })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .leftJoin(bills, eq(bills.visitId, visits.id))
      .where(where),
  ]);

  return { rows, total: Number(countRow[0]?.n ?? 0), page, pageSize };
}

export async function getVisitDetail(labId: string, visitId: string) {
  // Round-trip 1: everything keyed directly off visitId, sent as a single
  // libSQL batch (one HTTP request) instead of five sequential queries.
  const [visitRows, billRows, vTests, sampleRows, linkRows] = await db.batch([
    db.select().from(visits).where(and(eq(visits.id, visitId), eq(visits.labId, labId))),
    db.select().from(bills).where(eq(bills.visitId, visitId)),
    db.select().from(visitTests).where(eq(visitTests.visitId, visitId)),
    db.select().from(samples).where(eq(samples.visitId, visitId)),
    db.select().from(reportLinks).where(eq(reportLinks.visitId, visitId)),
  ]);

  const visit = visitRows.at(0);
  if (!visit) return null;
  const bill = billRows.at(0);

  // Round-trip 2: rows that depend on visit.patientId / bill.id. When there is
  // no bill, billId "" matches nothing so items/payments come back empty —
  // identical to the previous `bill ? … : []` behaviour.
  const [patientRows, items, payRows] = await db.batch([
    db.select().from(patients).where(eq(patients.id, visit.patientId)),
    db.select().from(billItems).where(eq(billItems.billId, bill?.id ?? "")),
    db.select().from(payments).where(eq(payments.billId, bill?.id ?? "")).orderBy(desc(payments.paidAt)),
  ]);

  return {
    visit,
    patient: patientRows.at(0),
    bill,
    items: bill ? items : [],
    visitTests: vTests,
    payments: bill ? payRows : [],
    samples: sampleRows,
    reportLink: linkRows.at(0),
  };
}

export async function getBillForPrint(labId: string, visitId: string) {
  return getVisitDetail(labId, visitId);
}
