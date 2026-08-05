import "server-only";
import { db } from "@/db/client";
import { reportLinks, resultEntries, bills, visits, patients, labs, labSettings, tests, departments } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
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

/**
 * Per-test approval progress for a visit.
 *
 * A visit rarely finishes in one go — a CBC is ready in minutes while a culture
 * takes days — so this reports how many of the visit's reportable tests are
 * already approved. The public report link is released as soon as the FIRST one
 * is approved (and the bill is cleared); the page then shows those tests and
 * picks up the rest automatically as they are approved.
 */
export interface ApprovalProgress {
  /** Reportable tests on the visit (billing-only items excluded). */
  total: number;
  /** Tests already approved (or approved and since dispatched). */
  approved: number;
  /** Tests still waiting for entry / approval. */
  pending: number;
  /** Names of the tests still in progress — for a patient-friendly notice. */
  pendingTests: string[];
  /** At least one test is approved, so the report has something to show. */
  hasApproved: boolean;
  /** Every reportable test is approved — the report is final. */
  isComplete: boolean;
}

export async function getApprovalProgress(visitId: string): Promise<ApprovalProgress> {
  const rows = await db
    .select({ status: resultEntries.status, testName: resultEntries.testName, billingOnly: departments.billingOnly })
    .from(resultEntries)
    .leftJoin(tests, eq(resultEntries.testId, tests.id))
    .leftJoin(departments, eq(tests.departmentId, departments.id))
    .where(eq(resultEntries.visitId, visitId));
  // Billing-only tests (dental, consultation, radiology…) never get a result
  // entered, so a stub left over from before the department was flagged — or
  // from an older visit — must not hold the report back forever.
  const relevant = rows.filter((r) => !r.billingOnly && r.status !== ("cancelled" as never));
  const done = relevant.filter((r) => r.status === "approved" || r.status === "dispatched");
  const waiting = relevant.filter((r) => r.status !== "approved" && r.status !== "dispatched");
  return {
    total: relevant.length,
    approved: done.length,
    pending: waiting.length,
    pendingTests: waiting.map((r) => r.testName),
    hasApproved: done.length > 0,
    isComplete: relevant.length > 0 && waiting.length === 0,
  };
}

/** True when every non-cancelled result entry on the visit is approved (and at least one exists). */
export async function isVisitFullyApproved(visitId: string) {
  return (await getApprovalProgress(visitId)).isComplete;
}

/** True when the visit's bill has no outstanding due. */
export async function isDueCleared(visitId: string) {
  const bill = (await db.select().from(bills).where(eq(bills.visitId, visitId))).at(0);
  if (!bill) return false;
  if (bill.status === "cancelled") return false;
  return (bill.dueAmount ?? 0) <= 0;
}

/**
 * Activate the public report link once results are approved AND dues cleared.
 * Safe to call repeatedly — it no-ops when the conditions aren't met.
 *
 * Release is **progressive**: the link goes live as soon as the first test is
 * approved, so a patient scanning the QR on their bill sees the tests that are
 * already done instead of a "being processed" screen; the same page fills in
 * with the remaining tests as those get approved (it renders whatever is
 * approved at the moment it is opened).
 *
 * The final release — marking the visit approved and sending the "report ready"
 * SMS/email — still waits for the LAST test. `activatedAt` records that final
 * release and doubles as the "already notified" flag, so a partial release
 * never causes a duplicate (or premature) message.
 */
export async function activateReportLinkIfReady(visitId: string): Promise<boolean> {
  const [progress, cleared] = await Promise.all([getApprovalProgress(visitId), isDueCleared(visitId)]);
  if (!progress.hasApproved || !cleared) return false;

  const visit = (await db.select().from(visits).where(eq(visits.id, visitId))).at(0);
  if (!visit) return false;

  const link = await ensureReportLink(visitId, visit.labId);
  if (!link.isActive) {
    await db.update(reportLinks).set({ isActive: true }).where(eq(reportLinks.id, link.id));
  }

  if (progress.isComplete) {
    // Mark visit approved (if not already further along).
    if (visit.status !== "dispatched") {
      await db.update(visits).set({ status: "approved" }).where(eq(visits.id, visitId));
    }
    // Send the report-ready SMS — once, on the final release.
    if (!link.activatedAt) {
      await db.update(reportLinks).set({ activatedAt: new Date() }).where(eq(reportLinks.id, link.id));
      await trySendReportReadySms(visitId, link.token);
    }
  }
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
