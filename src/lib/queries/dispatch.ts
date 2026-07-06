import "server-only";
import { db } from "@/db/client";
import { visits, patients, bills, reportLinks, reportDispatches, smsLogs } from "@/db/schema";
import { and, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";

/** Visits whose reports are approved (ready for / already dispatched). */
export async function listReports(labId: string, opts: { q?: string; status?: string; from?: string; to?: string } = {}) {
  const term = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const statuses = opts.status === "dispatched" ? ["dispatched"] : opts.status === "ready" ? ["approved"] : ["approved", "dispatched"];
  const conds = [eq(visits.labId, labId), inArray(visits.status, statuses as never)];
  if (term) conds.push(or(like(visits.code, term), like(patients.fullName, term), like(patients.phone, term))!);
  if (opts.from) conds.push(gte(visits.visitDate, new Date(opts.from)));
  if (opts.to) {
    const end = new Date(opts.to);
    end.setHours(23, 59, 59, 999);
    conds.push(lte(visits.visitDate, end));
  }

  const rows = await db
    .select({
      visitId: visits.id,
      visitCode: visits.code,
      status: visits.status,
      patientName: patients.fullName,
      patientCode: patients.code,
      patientPhone: patients.phone,
      patientEmail: patients.email,
      dueAmount: bills.dueAmount,
      linkActive: reportLinks.isActive,
      token: reportLinks.token,
      viewCount: reportLinks.viewCount,
      updatedAt: visits.updatedAt,
      smsCount: sql<number>`(select count(*) from sms_logs where sms_logs.visit_id = ${visits.id} and sms_logs.status = 'sent')`,
      dispatchCount: sql<number>`(select count(*) from report_dispatches where report_dispatches.visit_id = ${visits.id})`,
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .leftJoin(bills, eq(bills.visitId, visits.id))
    .leftJoin(reportLinks, eq(reportLinks.visitId, visits.id))
    .where(and(...conds))
    .orderBy(desc(visits.updatedAt))
    .limit(200);

  return rows.map((r) => ({ ...r, smsCount: Number(r.smsCount), dispatchCount: Number(r.dispatchCount) }));
}
