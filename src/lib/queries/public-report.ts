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

  if (link.isActive) {
    // The link may have been released with only some tests approved (slow tests
    // like cultures take days) — `getReportData` returns whatever is approved
    // right now, and `progress` tells the page what is still to come.
    const [data, progress] = await Promise.all([getReportData(link.labId, link.visitId), getApprovalProgress(link.visitId)]);
    if (!data || data.entries.length === 0) return { status: "processing", linkId: link.id, labId: link.labId };
    return { status: "ready", data, progress, linkId: link.id, labId: link.labId };
  }

  // Not active — explain why in patient-friendly terms.
  const [progress, cleared] = await Promise.all([getApprovalProgress(link.visitId), isDueCleared(link.visitId)]);
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
