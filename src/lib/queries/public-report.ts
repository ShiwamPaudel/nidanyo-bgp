import "server-only";
import { db } from "@/db/client";
import { reportLinks, reportAccessLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getApprovalProgress, isDueCleared, type ApprovalProgress } from "@/lib/report-engine";
import { getReportData } from "@/lib/queries/report";

export type PublicReportState =
  | { status: "invalid" }
  | { status: "processing" }
  | { status: "payment_pending" }
  | {
      status: "ready";
      data: NonNullable<Awaited<ReturnType<typeof getReportData>>>;
      /** How much of the visit is done — `pending > 0` means more tests are still to come. */
      progress: ApprovalProgress;
    };

/** Resolve a public token into a safe state. Never exposes internal ids. */
export async function resolvePublicReport(token: string): Promise<PublicReportState & { linkId?: string; labId?: string }> {
  if (!token || token.length < 10) return { status: "invalid" };
  const link = (await db.select().from(reportLinks).where(eq(reportLinks.token, token))).at(0);
  if (!link) return { status: "invalid" };

  // What the patient may see is DERIVED here, not read from the stored
  // `is_active` flag alone: at least one approved test + no outstanding due.
  // Trusting the flag on its own stranded every visit that already met the
  // conditions before its last approval/payment event — approved and paid, but
  // nothing left to fire the activation, so the link answered "being processed"
  // forever. Deriving it also means the page follows the results by itself: it
  // shows whatever is approved at the moment it is opened (slow tests like
  // cultures simply appear later), with `progress` describing what is to come.
  const [progress, cleared] = await Promise.all([getApprovalProgress(link.visitId), isDueCleared(link.visitId)]);

  if (link.isActive || (progress.hasApproved && cleared)) {
    const data = await getReportData(link.labId, link.visitId);
    if (!data || data.entries.length === 0) return { status: "processing", linkId: link.id, labId: link.labId };
    // Catch the stored flag up, so Reports/Dispatch and the visit screen agree
    // with what the patient is being shown. Deliberately silent — no SMS is
    // sent from a page view; notification stays with the approval flow.
    if (!link.isActive) {
      await db.update(reportLinks).set({ isActive: true }).where(eq(reportLinks.id, link.id));
    }
    return { status: "ready", data, progress, linkId: link.id, labId: link.labId };
  }

  // Not releasable — explain why in patient-friendly terms.
  if (progress.hasApproved && !cleared) return { status: "payment_pending", linkId: link.id, labId: link.labId };
  return { status: "processing", linkId: link.id, labId: link.labId };
}

export async function logReportAccess(
  linkId: string,
  action: "view" | "download" | "blocked",
  meta: { reason?: string; ip?: string; userAgent?: string } = {},
) {
  try {
    await db.insert(reportAccessLogs).values({ reportLinkId: linkId, action, reason: meta.reason, ip: meta.ip, userAgent: meta.userAgent });
    if (action === "view") {
      await db.update(reportLinks).set({ viewCount: sql`${reportLinks.viewCount} + 1`, lastViewedAt: new Date() }).where(eq(reportLinks.id, linkId));
    }
  } catch {
    /* ignore */
  }
}
