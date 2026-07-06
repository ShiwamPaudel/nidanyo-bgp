import "server-only";
import { db } from "@/db/client";
import { smsLogs } from "@/db/schema";

/**
 * SMS adapter — provider-agnostic. Every send is logged to sms_logs with its
 * status so failures can be retried and dispatch can show delivery state.
 *
 * Implemented now: "mock" (logs only — safe default; no real sending).
 * Stubs documented for Sparrow SMS (Nepal), Twilio, and a generic HTTP gateway.
 */

export interface SmsResult {
  ok: boolean;
  providerMessageId?: string;
  error?: string;
}

const PROVIDER = process.env.SMS_PROVIDER || "mock";

async function deliver(to: string, body: string): Promise<SmsResult> {
  switch (PROVIDER) {
    case "mock":
      // Developer-visible only; never shown to end users.
      console.log(`[SMS:mock] -> ${to}: ${body}`);
      return { ok: true, providerMessageId: `mock-${Date.now()}` };

    case "sparrow": {
      const token = process.env.SPARROW_SMS_TOKEN;
      const from = process.env.SMS_SENDER_ID || "Nidanyo";
      if (!token) return { ok: false, error: "SMS not configured" };
      try {
        const res = await fetch("https://api.sparrowsms.com/v2/sms/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, from, to, text: body }),
        });
        const data = (await res.json().catch(() => ({}))) as { response_code?: number; message_id?: string };
        if (res.ok && (data.response_code === 200 || data.message_id)) {
          return { ok: true, providerMessageId: String(data.message_id ?? "") };
        }
        return { ok: false, error: `Provider responded ${res.status}` };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    case "twilio": {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM_NUMBER;
      if (!sid || !authToken || !from) return { ok: false, error: "SMS not configured" };
      try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: "Basic " + Buffer.from(`${sid}:${authToken}`).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: from, Body: body }),
        });
        const data = (await res.json().catch(() => ({}))) as { sid?: string };
        if (res.ok && data.sid) return { ok: true, providerMessageId: data.sid };
        return { ok: false, error: `Provider responded ${res.status}` };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    case "generic_http": {
      const endpoint = process.env.SMS_HTTP_ENDPOINT;
      const apiKey = process.env.SMS_HTTP_API_KEY;
      if (!endpoint) return { ok: false, error: "SMS not configured" };
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
          body: JSON.stringify({ to, from: process.env.SMS_SENDER_ID || "Nidanyo", text: body }),
        });
        if (res.ok) return { ok: true, providerMessageId: `http-${Date.now()}` };
        return { ok: false, error: `Provider responded ${res.status}` };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }

    default:
      return { ok: false, error: "SMS not configured" };
  }
}

/** Send an SMS and persist a log row. Returns the result; never throws. */
export async function sendSms(params: {
  labId: string;
  toPhone: string;
  body: string;
  purpose?: "report_ready" | "due_cleared" | "manual_resend" | "other";
  visitId?: string;
  sentBy?: string;
}): Promise<SmsResult> {
  const { labId, toPhone, body, purpose = "other", visitId, sentBy } = params;
  const result = await deliver(toPhone, body);
  try {
    await db.insert(smsLogs).values({
      labId,
      visitId,
      toPhone,
      body,
      purpose,
      provider: PROVIDER,
      status: result.ok ? "sent" : "failed",
      providerMessageId: result.providerMessageId,
      error: result.error,
      attempts: 1,
      sentBy,
    });
  } catch {
    /* logging failure shouldn't mask the send result */
  }
  return result;
}

/** Build the standard "report ready" message. */
export function reportReadyMessage(patientName: string, labName: string, link: string) {
  return `Dear ${patientName}, your laboratory report from ${labName} is ready. View here: ${link}`;
}
