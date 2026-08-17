import "server-only";
import { db } from "@/db/client";
import { visits, patients, bills, reportLinks } from "@/db/schema";
import { and, desc, eq, gte, inArray, like, lte, ne, or, sql } from "drizzle-orm";
import { labDayBounds, parseLabYmd } from "@/lib/datetime";

/** Rows returned in one page of the report/dispatch list. */
export const REPORTS_PAGE_LIMIT = 200;

/**
 * Visits whose reports are approved (ready for / already dispatched).
 *
 * `includePartial` also surfaces visits that are not fully approved yet but have
 * at least one approved test — so the completed tests can be printed and handed
 * over while the rest are still in progress. Used by the Reports page only;
 * Dispatch leaves it off and keeps showing fully-approved visits.
 *
 * Returns at most REPORTS_PAGE_LIMIT rows plus a `hasMore` flag; callers must
 * surface that flag so a truncated list never looks complete.
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
      billStatus: bills.status,
      linkActive: reportLinks.isActive,
      // Same rule the public page derives from, so this column tells the truth
      // for a visit that became eligible without an approval/payment event to
      // flip the stored flag (the flag catches up on the first patient view).
      hasApprovedTest: sql<number>`exists (select 1 from result_entries re where re.visit_id = ${visits.id} and re.status in ('approved','dispatched'))`,
      token: reportLinks.token,
      viewCount: reportLinks.viewCount,
      updatedAt: visits.updatedAt,
      // No sms_logs count here any more: SMS is dormant (see lib/messaging.ts),
      // so the column showed nothing actionable while costing a correlated
      // scan of sms_logs for every row. The report_dispatches count that used
      // to sit alongside it was never rendered at all.
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .leftJoin(bills, eq(bills.visitId, visits.id))
    .leftJoin(reportLinks, eq(reportLinks.visitId, visits.id))
    .where(and(...conds))
    .orderBy(desc(visits.updatedAt))
    // One extra row tells us whether more exist, so the page can say so
    // instead of silently truncating.
    .limit(REPORTS_PAGE_LIMIT + 1);

  const hasMore = rows.length > REPORTS_PAGE_LIMIT;
  const page = hasMore ? rows.slice(0, REPORTS_PAGE_LIMIT) : rows;

  return {
    rows: page.map(({ billStatus, hasApprovedTest, ...r }) => ({
      ...r,
      linkActive: r.linkActive || (Number(hasApprovedTest) > 0 && (r.dueAmount ?? 0) <= 0 && billStatus === "active" && r.status !== "cancelled"),
    })),
    hasMore,
  };
}
