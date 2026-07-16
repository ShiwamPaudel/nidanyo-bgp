import "server-only";
import { db } from "@/db/client";
import { reportLinks, resultEntries, bills, visits, patients, labs, labSettings, tests, departments } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";
import { publicToken } from "@/lib/crypto";
import { sendSms, reportReadyMessage } from "@/lib/sms";
import { sendEmail, reportReadyEmail } from "@/lib/email";

/** Ensure a visit has a report link (token), creating one if needed. */
export async function ensureReportLink(visitId: string, labId: string) {
  const existing = (await db.select().from(reportLinks).where(eq(reportLinks.visitId, visitId))).at(0);
  if (existing) return existing;
  const [row] = await db
    .insert(reportLinks)
    .values({ labId, visitId, token: publicToken(), isActive: false })
    .returning();
  return row;
}

/** True when every non-cancelled result entry on the visit is approved (and at least one exists). */
export async function isVisitFullyApproved(visitId: string) {
  const rows = await db
    .select({ status: resultEntries.status, billingOnly: departments.billingOnly })
    .from(resultEntries)
    .leftJoin(tests, eq(resultEntries.testId, tests.id))
    .leftJoin(departments, eq(tests.departmentId, departments.id))
    .where(and(eq(resultEntries.visitId, visitId), ne(resultEntries.status, "dispatched")));
  // Billing-only tests (dental, consultation, radiology…) never get a result
  // entered, so a stub left over from before the department was flagged — or
  // from an older visit — must not hold the report back forever.
  const relevant = rows.filter((r) => !r.billingOnly && r.status !== ("cancelled" as never));
  if (relevant.length === 0) return false;
  return relevant.every((r) => r.status === "approved");
}

/** True when the visit's bill has no outstanding due. */
export async function isDueCleared(visitId: string) {
  const bill = (await db.select().from(bills).where(eq(bills.visitId, visitId))).at(0);
  if (!bill) return false;
  if (bill.status === "cancelled") return false;
  return (bill.dueAmount ?? 0) <= 0;
}

/**
 * Activate the public report link when results are approved AND dues cleared.
 * Sends the "report ready" SMS exactly once (on first activation). Safe to call
 * repeatedly — it no-ops if conditions aren't met or it's already active.
 */
export async function activateReportLinkIfReady(visitId: string): Promise<boolean> {
  const [approved, cleared] = await Promise.all([isVisitFullyApproved(visitId), isDueCleared(visitId)]);
  if (!approved || !cleared) return false;

  const visit = (await db.select().from(visits).where(eq(visits.id, visitId))).at(0);
  if (!visit) return false;

  const link = await ensureReportLink(visitId, visit.labId);
  if (link.isActive) return true; // already activated; don't resend

  await db
    .update(reportLinks)
    .set({ isActive: true, activatedAt: new Date() })
    .where(eq(reportLinks.id, link.id));

  // Mark visit approved (if not already further along).
  if (visit.status !== "dispatched") {
    await db.update(visits).set({ status: "approved" }).where(eq(visits.id, visitId));
  }

  // Send the report-ready SMS.
  await trySendReportReadySms(visitId, link.token);
  return true;
}

/** Build the public report URL from the lab's configured base or env. */
export async function reportUrl(token: string, labId?: string) {
  let base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  if (labId) {
    const s = (await db.select().from(labSettings).where(eq(labSettings.labId, labId))).at(0);
    if (s?.shortLinkBaseUrl) base = s.shortLinkBaseUrl;
  }
  return `${base.replace(/\/$/, "")}/r/${token}`;
}

async function trySendReportReadySms(visitId: string, token: string, manual = false, sentBy?: string) {
  const visit = (await db.select().from(visits).where(eq(visits.id, visitId))).at(0);
  if (!visit) return;
  const patient = (await db.select().from(patients).where(eq(patients.id, visit.patientId))).at(0);
  if (!patient) return;
  const lab = (await db.select().from(labs).where(eq(labs.id, visit.labId))).at(0);
  const labName = lab?.name ?? "the laboratory";
  const url = await reportUrl(token, visit.labId);

  // SMS (if phone present)
  if (patient.phone) {
    await sendSms({
      labId: visit.labId,
      toPhone: patient.phone,
      body: reportReadyMessage(patient.fullName, labName, url),
      purpose: manual ? "manual_resend" : "report_ready",
      visitId,
      sentBy,
    });
  }
  // Email (if email present)
  if (patient.email) {
    const { subject, html } = reportReadyEmail(patient.fullName, labName, url);
    await sendEmail({
      labId: visit.labId,
      toEmail: patient.email,
      subject,
      html,
      purpose: manual ? "manual_resend" : "report_ready",
      visitId,
      sentBy,
    });
  }
}

/** Manually (re)send the report SMS — used by dispatch "resend". */
export async function resendReportSms(visitId: string, sentBy?: string) {
  const link = (await db.select().from(reportLinks).where(eq(reportLinks.visitId, visitId))).at(0);
  if (!link || !link.isActive) return { ok: false as const, error: "Report is not ready to share yet." };
  await trySendReportReadySms(visitId, link.token, true, sentBy);
  return { ok: true as const };
}

/** Manually send the report link by email — used by dispatch "email". */
export async function sendReportEmail(visitId: string, sentBy?: string) {
  const link = (await db.select().from(reportLinks).where(eq(reportLinks.visitId, visitId))).at(0);
  if (!link || !link.isActive) return { ok: false as const, error: "Report is not ready to share yet." };
  const visit = (await db.select().from(visits).where(eq(visits.id, visitId))).at(0);
  if (!visit) return { ok: false as const, error: "Visit not found." };
  const patient = (await db.select().from(patients).where(eq(patients.id, visit.patientId))).at(0);
  if (!patient?.email) return { ok: false as const, error: "This patient has no email address on file." };
  const lab = (await db.select().from(labs).where(eq(labs.id, visit.labId))).at(0);
  const url = await reportUrl(link.token, visit.labId);
  const { subject, html } = reportReadyEmail(patient.fullName, lab?.name ?? "the laboratory", url);
  const res = await sendEmail({ labId: visit.labId, toEmail: patient.email, subject, html, purpose: "manual_resend", visitId, sentBy });
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error ?? "Could not send email." };
}

export { sql };
