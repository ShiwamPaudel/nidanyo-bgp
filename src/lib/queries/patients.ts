import "server-only";
import { db } from "@/db/client";
import { patients, visits, bills, payments } from "@/db/schema";
import { and, desc, eq, like, or, sql } from "drizzle-orm";

export async function listPatients(labId: string, opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = opts.pageSize ?? 20;
  const q = opts.q?.trim();
  const term = q ? `%${q}%` : null;

  const where = and(
    eq(patients.labId, labId),
    eq(patients.isActive, true),
    term ? or(like(patients.fullName, term), like(patients.phone, term), like(patients.code, term)) : undefined,
  );

  const [rows, countRow] = await Promise.all([
    db
      .select({
        id: patients.id,
        code: patients.code,
        fullName: patients.fullName,
        gender: patients.gender,
        ageValue: patients.ageValue,
        ageUnit: patients.ageUnit,
        phone: patients.phone,
        referredBy: patients.referredBy,
        createdAt: patients.createdAt,
        visitCount: sql<number>`(select count(*) from visits where visits.patient_id = ${patients.id})`,
      })
      .from(patients)
      .where(where)
      .orderBy(desc(patients.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: sql<number>`count(*)` }).from(patients).where(where),
  ]);

  return {
    rows: rows.map((r) => ({ ...r, visitCount: Number(r.visitCount) })),
    total: Number(countRow[0]?.n ?? 0),
    page,
    pageSize,
  };
}

export async function getPatient(labId: string, id: string) {
  return (await db.select().from(patients).where(and(eq(patients.id, id), eq(patients.labId, labId)))).at(0) ?? null;
}

/** Full patient profile: visits, payments, dues, totals. */
export async function getPatientProfile(labId: string, id: string) {
  const patient = await getPatient(labId, id);
  if (!patient) return null;

  const visitRows = await db
    .select({
      id: visits.id,
      code: visits.code,
      status: visits.status,
      priority: visits.priority,
      visitDate: visits.visitDate,
      billId: bills.id,
      billCode: bills.code,
      grandTotal: bills.grandTotal,
      paidAmount: bills.paidAmount,
      dueAmount: bills.dueAmount,
      paymentStatus: bills.paymentStatus,
      billStatus: bills.status,
    })
    .from(visits)
    .leftJoin(bills, eq(bills.visitId, visits.id))
    .where(eq(visits.patientId, id))
    .orderBy(desc(visits.visitDate));

  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.patientId, id))
    .orderBy(desc(payments.paidAt))
    .limit(50);

  const totals = visitRows.reduce(
    (acc, v) => {
      if (v.billStatus === "cancelled") return acc;
      acc.billed += v.grandTotal ?? 0;
      acc.paid += v.paidAmount ?? 0;
      acc.due += v.dueAmount ?? 0;
      return acc;
    },
    { billed: 0, paid: 0, due: 0 },
  );

  return { patient, visits: visitRows, payments: paymentRows, totals };
}
