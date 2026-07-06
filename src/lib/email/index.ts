import "server-only";
import { db } from "@/db/client";
import { emailLogs } from "@/db/schema";

/**
 * Email adapter — provider-agnostic, mirrors the SMS adapter. Every send is
 * logged to email_logs. Implemented via HTTP APIs (no extra dependency):
 *   "mock"    — logs only (safe default)
 *   "resend"  — RESEND_API_KEY
 *   "sendgrid"— SENDGRID_API_KEY
 *   "generic_http" — EMAIL_HTTP_ENDPOINT (+ optional EMAIL_HTTP_API_KEY)
 */

export interface EmailResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

const PROVIDER = process.env.EMAIL_PROVIDER || "mock";
const FROM = process.env.EMAIL_FROM || "Nidanyo <no-reply@nidanyo.local>";

async function deliver(to: string, subject: string, html: string): Promise<EmailResult> {
  switch (PROVIDER) {
    case "mock":
      console.log(`[EMAIL:mock] -> ${to} | ${subject}`);
      return { ok: true, providerMessageId: `mock-${Date.now()}` };

    case "resend": {
      const key = process.env.RESEND_API_KEY;
      if (!key) return { ok: false, error: "Email not configured" };
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: [to], subject, html }),
        });
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return res.ok ? { ok: true, providerMessageId: data.id } : { ok: false, error: `Provider responded ${res.status}` };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    case "sendgrid": {
      const key = process.env.SENDGRID_API_KEY;
      if (!key) return { ok: false, error: "Email not configured" };
      try {
        const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: FROM.replace(/.*<(.+)>.*/, "$1") },
            subject,
            content: [{ type: "text/html", value: html }],
          }),
        });
        return res.ok ? { ok: true, providerMessageId: res.headers.get("x-message-id") ?? undefined } : { ok: false, error: `Provider responded ${res.status}` };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    case "generic_http": {
      const endpoint = process.env.EMAIL_HTTP_ENDPOINT;
      if (!endpoint) return { ok: false, error: "Email not configured" };
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(process.env.EMAIL_HTTP_API_KEY ? { Authorization: `Bearer ${process.env.EMAIL_HTTP_API_KEY}` } : {}) },
          body: JSON.stringify({ from: FROM, to, subject, html }),
        });
        return res.ok ? { ok: true } : { ok: false, error: `Provider responded ${res.status}` };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    default:
      return { ok: false, error: "Email not configured" };
  }
}

export async function sendEmail(params: {
  labId: string;
  toEmail: string;
  subject: string;
  html: string;
  purpose?: "report_ready" | "due_cleared" | "manual_resend" | "test" | "other";
  visitId?: string;
  sentBy?: string;
}): Promise<EmailResult> {
  const { labId, toEmail, subject, html, purpose = "other", visitId, sentBy } = params;
  const result = await deliver(toEmail, subject, html);
  try {
    await db.insert(emailLogs).values({
      labId,
      visitId,
      toEmail,
      subject,
      body: html,
      purpose,
      provider: PROVIDER,
      status: result.ok ? "sent" : "failed",
      providerMessageId: result.providerMessageId,
      error: result.error,
      sentBy,
    });
  } catch {
    /* logging failure shouldn't mask the result */
  }
  return result;
}

/** Branded HTML for the "report ready" email. */
export function reportReadyEmail(patientName: string, labName: string, link: string) {
  const subject = `Your laboratory report from ${labName} is ready`;
  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0E1B14">
    <div style="border-bottom:3px solid #075323;padding-bottom:12px;margin-bottom:16px">
      <h2 style="margin:0;color:#075323">${labName}</h2>
    </div>
    <p>Dear ${patientName},</p>
    <p>Your laboratory report is now ready. You can view and download it securely using the button below.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#075323;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block">View my report</a>
    </p>
    <p style="font-size:13px;color:#647067">Or open this link: <a href="${link}" style="color:#144FCA">${link}</a></p>
    <p style="font-size:12px;color:#647067;margin-top:24px">This is an automated message from ${labName}.</p>
  </div>`;
  return { subject, html };
}
