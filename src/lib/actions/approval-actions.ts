"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { resultEntries, resultApprovals, visitTests, visits, bills } from "@/db/schema";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ActionResult, ok, fail, run } from "@/lib/action";
import { audit, activity } from "@/lib/audit";
import { activateReportLinkIfReady } from "@/lib/report-engine";

/** Approve all submitted results for a visit, applying the pathologist's signature. */
export async function approveVisit(input: { visitId: string; interpretation?: string | null }): Promise<ActionResult<{ released: boolean }>> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.APPROVAL_ACT);
    const visit = (await db.select().from(visits).where(and(eq(visits.id, input.visitId), eq(visits.labId, user.labId)))).at(0);
    if (!visit) return fail("Visit not found.");

    const submitted = await db
      .select()
      .from(resultEntries)
      .where(and(eq(resultEntries.visitId, input.visitId), eq(resultEntries.status, "submitted")));
    if (submitted.length === 0) return fail("There are no results awaiting approval.");

    const now = new Date();
    for (const e of submitted) {
      await db
        .update(resultEntries)
        .set({
          status: "approved",
          approvedBy: user.id,
          approvedByName: user.name,
          approvedByDesignation: user.designation ?? null,
          approvedAt: now,
          interpretation: input.interpretation ?? e.interpretation ?? null,
          correctionNote: null,
        })
        .where(eq(resultEntries.id, e.id));
      await db.update(visitTests).set({ status: "approved" }).where(eq(visitTests.id, e.visitTestId));
      await db.insert(resultApprovals).values({
        resultEntryId: e.id,
        action: "approved",
        interpretation: input.interpretation ?? null,
        actorId: user.id,
        actorName: user.name,
        actorDesignation: user.designation ?? null,
      });
    }

    // If every result entry on the visit is now approved, mark visit + try release.
    const remaining = await db
      .select({ id: resultEntries.id })
      .from(resultEntries)
      .where(and(eq(resultEntries.visitId, input.visitId), inArray(resultEntries.status, ["pending", "draft", "submitted", "correction_required"] as never)));

    let released = false;
    if (remaining.length === 0) {
      await db.update(visits).set({ status: "approved" }).where(eq(visits.id, input.visitId));
      released = await activateReportLinkIfReady(input.visitId);
    }

    await audit(user, "result.approve", { entity: "visit", entityId: input.visitId, summary: `Approved results for ${visit.code}` });
    await activity(user, "result_approved", `Approved results for ${visit.code}`, { entity: "visit", entityId: input.visitId });

    revalidatePath("/approval");
    revalidatePath("/reports");
    revalidatePath("/dispatch");

    const bill = (await db.select().from(bills).where(eq(bills.visitId, input.visitId))).at(0);
    const message = released
      ? "Approved — report released and SMS sent"
      : bill && bill.dueAmount > 0
        ? "Approved — report will release once payment is cleared"
        : "Results approved";
    return ok({ released }, message);
  });
}

/** Send selected (or all submitted) results back to the technician for correction. */
export async function sendBackResults(input: { visitId: string; reason: string; entryIds?: string[] }): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.APPROVAL_ACT);
    if (!input.reason || input.reason.trim().length < 3) return fail("Please provide a reason.");
    const visit = (await db.select().from(visits).where(and(eq(visits.id, input.visitId), eq(visits.labId, user.labId)))).at(0);
    if (!visit) return fail("Visit not found.");

    const target = input.entryIds?.length
      ? await db.select().from(resultEntries).where(and(eq(resultEntries.visitId, input.visitId), inArray(resultEntries.id, input.entryIds), eq(resultEntries.status, "submitted")))
      : await db.select().from(resultEntries).where(and(eq(resultEntries.visitId, input.visitId), eq(resultEntries.status, "submitted")));
    if (target.length === 0) return fail("There are no submitted results to send back.");

    for (const e of target) {
      await db.update(resultEntries).set({ status: "correction_required", correctionNote: input.reason }).where(eq(resultEntries.id, e.id));
      await db.update(visitTests).set({ status: "correction_required" }).where(eq(visitTests.id, e.visitTestId));
      await db.insert(resultApprovals).values({ resultEntryId: e.id, action: "sent_back", reason: input.reason, actorId: user.id, actorName: user.name });
    }
    await db.update(visits).set({ status: "result_pending" }).where(eq(visits.id, input.visitId));

    await audit(user, "result.send_back", { entity: "visit", entityId: input.visitId, summary: `Sent ${visit.code} back for correction: ${input.reason}` });
    await activity(user, "result_sent_back", `Sent ${visit.code} back for correction`, { entity: "visit", entityId: input.visitId });

    revalidatePath("/approval");
    revalidatePath("/results");
    return ok(undefined, "Sent back for correction");
  });
}
