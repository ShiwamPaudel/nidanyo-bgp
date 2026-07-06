"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { samples, sampleEvents, visitTests, visits } from "@/db/schema";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ActionResult, ok, fail, run } from "@/lib/action";
import { audit, activity } from "@/lib/audit";

async function recordEvent(sampleId: string, from: string | null, to: string, note: string | null, actorId?: string, actorName?: string) {
  await db.insert(sampleEvents).values({ sampleId, fromStatus: from, toStatus: to, note, actorId, actorName });
}

/** Mark a sample collected and unlock its tests for result entry. */
export async function collectSample(sampleId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.SAMPLE_MANAGE);
    const sample = (await db.select().from(samples).where(and(eq(samples.id, sampleId), eq(samples.labId, user.labId)))).at(0);
    if (!sample) return fail("Sample not found.");
    if (sample.status === "collected") return fail("This sample is already collected.");

    await db
      .update(samples)
      .set({ status: "collected", collectedAt: new Date(), collectedBy: user.id, collectedByName: user.name, rejectionReason: null })
      .where(eq(samples.id, sampleId));
    await recordEvent(sampleId, sample.status, "collected", null, user.id, user.name);

    // Move ordered tests for this sample type into 'sample_collected'.
    if (sample.sampleTypeId) {
      await db
        .update(visitTests)
        .set({ status: "sample_collected" })
        .where(and(eq(visitTests.visitId, sample.visitId), eq(visitTests.sampleTypeId, sample.sampleTypeId), eq(visitTests.status, "ordered")));
    }
    await maybeAdvanceVisit(sample.visitId);

    await audit(user, "sample.collect", { entity: "sample", entityId: sampleId, summary: `Collected sample ${sample.code}` });
    await activity(user, "sample_collected", `Collected sample ${sample.code}`, { entity: "sample", entityId: sampleId });
    revalidatePath("/sample-collection");
    revalidatePath("/results");
    return ok(undefined, "Sample marked as collected");
  });
}

export async function rejectSample(sampleId: string, reason: string, recollection: boolean): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.SAMPLE_MANAGE);
    if (!reason || reason.trim().length < 3) return fail("Please provide a reason.");
    const sample = (await db.select().from(samples).where(and(eq(samples.id, sampleId), eq(samples.labId, user.labId)))).at(0);
    if (!sample) return fail("Sample not found.");
    const to = recollection ? "recollection" : "rejected";
    await db.update(samples).set({ status: to, rejectionReason: reason }).where(eq(samples.id, sampleId));
    await recordEvent(sampleId, sample.status, to, reason, user.id, user.name);
    await audit(user, "sample.reject", { entity: "sample", entityId: sampleId, summary: `${to === "recollection" ? "Recollection" : "Rejected"} ${sample.code}: ${reason}` });
    revalidatePath("/sample-collection");
    return ok(undefined, recollection ? "Marked for recollection" : "Sample rejected");
  });
}

/** Reset a rejected/recollection sample back to waiting (for re-draw). */
export async function resetSample(sampleId: string): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.SAMPLE_MANAGE);
    const sample = (await db.select().from(samples).where(and(eq(samples.id, sampleId), eq(samples.labId, user.labId)))).at(0);
    if (!sample) return fail("Sample not found.");
    await db.update(samples).set({ status: "waiting", rejectionReason: null }).where(eq(samples.id, sampleId));
    await recordEvent(sampleId, sample.status, "waiting", "Reset for collection", user.id, user.name);
    revalidatePath("/sample-collection");
    return ok(undefined, "Sample reset to waiting");
  });
}

/** If all samples for a visit are collected, advance the visit to in_progress. */
async function maybeAdvanceVisit(visitId: string) {
  const visitSamples = await db.select().from(samples).where(eq(samples.visitId, visitId));
  const allDone = visitSamples.length > 0 && visitSamples.every((s) => ["collected", "sent_to_lab", "processing", "completed"].includes(s.status));
  if (allDone) {
    const v = (await db.select().from(visits).where(eq(visits.id, visitId))).at(0);
    if (v && v.status === "sample_pending") {
      await db.update(visits).set({ status: "in_progress" }).where(eq(visits.id, visitId));
    }
  }
}
