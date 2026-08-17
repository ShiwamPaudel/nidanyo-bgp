"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reportDispatches, visits, resultEntries } from "@/db/schema";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ActionResult, ok, fail, run } from "@/lib/action";
import { audit, activity } from "@/lib/audit";
import { resendReportSms, sendReportEmail } from "@/lib/report-engine";
import { SMS_ENABLED, EMAIL_ENABLED } from "@/lib/messaging";

type Channel = "printed" | "collected" | "sms" | "email" | "downloaded";

/** Record a dispatch action for a visit's report and mark it dispatched. */
export async function recordDispatch(input: { visitId: string; channel: Channel; note?: string | null }): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.DISPATCH_ACT);
    // The UI hides these channels while they are dormant; reject them here too
    // so a stale page cannot record a delivery that never happened.
    if (input.channel === "sms" && !SMS_ENABLED) return fail("SMS is not enabled for this laboratory.");
    if (input.channel === "email" && !EMAIL_ENABLED) return fail("Email is not enabled for this laboratory.");

    const visit = (await db.select().from(visits).where(and(eq(visits.id, input.visitId), eq(visits.labId, user.labId)))).at(0);
    if (!visit) return fail("Visit not found.");
    if (visit.status !== "approved" && visit.status !== "dispatched") return fail("This report is not ready for dispatch yet.");

    // If dispatching by email, actually send it.
    if (input.channel === "email") {
      const sent = await sendReportEmail(input.visitId, user.id);
      if (!sent.ok) return fail(sent.error);
    }

    await db.insert(reportDispatches).values({
      labId: user.labId,
      visitId: input.visitId,
      channel: input.channel,
      note: input.note ?? null,
      actorId: user.id,
      actorName: user.name,
    });

    if (visit.status === "approved") {
      await db.update(visits).set({ status: "dispatched" }).where(eq(visits.id, input.visitId));
      await db.update(resultEntries).set({ status: "dispatched" }).where(and(eq(resultEntries.visitId, input.visitId), eq(resultEntries.status, "approved")));
    }

    const labels: Record<Channel, string> = { printed: "Printed", collected: "Collected by patient", sms: "Sent by SMS", email: "Sent by email", downloaded: "Downloaded" };
    await audit(user, "report.dispatch", { entity: "visit", entityId: input.visitId, summary: `Report ${visit.code} dispatched (${labels[input.channel]})` });
    await activity(user, "report_dispatched", `Dispatched report ${visit.code} (${labels[input.channel]})`, { entity: "visit", entityId: input.visitId });

    revalidatePath("/dispatch");
    revalidatePath("/reports");
    return ok(undefined, `Marked as ${labels[input.channel].toLowerCase()}`);
  });
}

/** Resend the report-ready SMS to the patient. */
export async function resendSms(input: { visitId: string }): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.SMS_SEND);
    const res = await resendReportSms(input.visitId, user.id);
    if (!res.ok) return fail(res.error);
    await db.insert(reportDispatches).values({ labId: user.labId, visitId: input.visitId, channel: "sms", note: "Manual resend", actorId: user.id, actorName: user.name });
    await audit(user, "report.resend_sms", { entity: "visit", entityId: input.visitId });
    revalidatePath("/dispatch");
    return ok(undefined, "SMS sent to the patient");
  });
}
