import "server-only";
import { db } from "@/db/client";
import { visits, bills, patients, visitTests, billItems, payments, samples, reportLinks } from "@/db/schema";
import { and, desc, eq, like, or, sql, gte, lte } from "drizzle-orm";

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
  if (opts.from) conds.push(gte(visits.visitDate, new Date(opts.from)));
  if (opts.to) {
    const end = new Date(opts.to);
    end.setHours(23, 59, 59, 999);
    conds.push(lte(visits.visitDate, end));
  }
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
  const visit = (await db.select().from(visits).where(and(eq(visits.id, visitId), eq(visits.labId, labId)))).at(0);
  if (!visit) return null;
  const patient = (await db.select().from(patients).where(eq(patients.id, visit.patientId))).at(0);
  const bill = (await db.select().from(bills).where(eq(bills.visitId, visitId))).at(0);
  const items = bill ? await db.select().from(billItems).where(eq(billItems.billId, bill.id)) : [];
  const vTests = await db.select().from(visitTests).where(eq(visitTests.visitId, visitId));
  const payRows = bill ? await db.select().from(payments).where(eq(payments.billId, bill.id)).orderBy(desc(payments.paidAt)) : [];
  const sampleRows = await db.select().from(samples).where(eq(samples.visitId, visitId));
  const link = (await db.select().from(reportLinks).where(eq(reportLinks.visitId, visitId))).at(0);

  return { visit, patient, bill, items, visitTests: vTests, payments: payRows, samples: sampleRows, reportLink: link };
}

export async function getBillForPrint(labId: string, visitId: string) {
  return getVisitDetail(labId, visitId);
}
