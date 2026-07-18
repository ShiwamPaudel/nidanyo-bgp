import "server-only";
import { db } from "@/db/client";
import { visits, patients, bills, reportLinks, reportDispatches, smsLogs } from "@/db/schema";
import { and, desc, eq, gte, inArray, like, lte, ne, or, sql } from "drizzle-orm";
import { labDayBounds, parseLabYmd } from "@/lib/datetime";

/**
 * Visits whose reports are approved (ready for / already dispatched).
 *
 * `includePartial` also surfaces visits that are not fully approved yet but have
 * at least one approved test — so the completed tests can be printed and handed
 * over while the rest are still in progress. Used by the Reports page only;
 * Dispatch leaves it off and keeps showing fully-approved visits.
 */
export async function listReports(labId: string, opts: { q?: string; status?: string; from?: string; to?: string; includePartial?: boolean } = {}) {
  const term = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const statuses = opts.status === "dispatched" ? ["dispatched"] : opts.status === "ready" ? ["approved"] : ["approved", "dispatched"];
  const statusCond = opts.includePartial
    ? or(
        inArray(visits.status, statuses as never),
        and(
          ne(visits.status, "cancelled"),
          sql`exists (select 1 from result_entries re where re.visit_id = ${visits.id} and re.status = 'approved')`,
        ),
      )!
    : inArray(visits.status, statuses as never);
  const conds = [eq(visits.labId, labId), statusCond];
  if (term) conds.push(or(like(visits.code, term), like(patients.fullName, term), like(patients.phone, term))!);
  // Date filters are calendar days at the lab, not on the server's clock.
  const fromYmd = opts.from ? parseLabYmd(opts.from) : null;
  if (fromYmd) conds.push(gte(visits.visitDate, labDayBounds(fromYmd.y, fromYmd.m, fromYmd.d).start));
  const toYmd = opts.to ? parseLabYmd(opts.to) : null;
  if (toYmd) conds.push(lte(visits.visitDate, labDayBounds(toYmd.y, toYmd.m, toYmd.d).end));

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
