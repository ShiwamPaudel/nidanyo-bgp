import "server-only";
import { db } from "@/db/client";
import { bills, visits, patients } from "@/db/schema";
import { and, desc, eq, gt, like, or, sql } from "drizzle-orm";

export async function listDues(labId: string, opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 20;
  const term = opts.q?.trim() ? `%${opts.q.trim()}%` : null;

  const conds = [eq(bills.labId, labId), eq(bills.status, "active"), gt(bills.dueAmount, 0)];
  if (term) conds.push(or(like(bills.code, term), like(visits.code, term), like(patients.fullName, term), like(patients.phone, term))!);
  const where = and(...conds);

  const [rows, totalRow, sumRow] = await Promise.all([
    db
      .select({
        billId: bills.id,
        billCode: bills.code,
        visitId: bills.visitId,
        visitCode: visits.code,
        patientName: patients.fullName,
        patientPhone: patients.phone,
        patientCode: patients.code,
        grandTotal: bills.grandTotal,
        paidAmount: bills.paidAmount,
        dueAmount: bills.dueAmount,
        paymentStatus: bills.paymentStatus,
        createdAt: bills.createdAt,
      })
      .from(bills)
      .innerJoin(visits, eq(bills.visitId, visits.id))
      .innerJoin(patients, eq(bills.patientId, patients.id))
      .where(where)
      .orderBy(desc(bills.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: sql<number>`count(*)` }).from(bills).innerJoin(visits, eq(bills.visitId, visits.id)).innerJoin(patients, eq(bills.patientId, patients.id)).where(where),
    db.select({ s: sql<number>`coalesce(sum(${bills.dueAmount}),0)` }).from(bills).where(and(eq(bills.labId, labId), eq(bills.status, "active"), gt(bills.dueAmount, 0))),
  ]);

  return { rows, total: Number(totalRow[0]?.n ?? 0), totalDue: Number(sumRow[0]?.s ?? 0), page, pageSize };
}
