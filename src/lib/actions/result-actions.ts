"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { resultEntries, resultValues, resultVersions, visitTests, visits, tests, testParameters } from "@/db/schema";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ActionResult, ok, fail, run } from "@/lib/action";
import { audit, activity } from "@/lib/audit";
import { computeFlag, isAbnormal, isCritical, refRangeText, type ResultFlag } from "@/lib/result-flags";

export interface ResultValueInput {
  parameterId: string | null;
  label: string;
  value: string; // raw entered value
}
export interface ResultEntryInput {
  entryId: string;
  technicianRemarks?: string | null;
  values: ResultValueInput[];
}

/** Save result values for a visit. mode 'draft' keeps editable; 'submit' sends for approval. */
export async function saveResults(input: { visitId: string; entries: ResultEntryInput[]; mode: "draft" | "submit" }): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.RESULT_ENTER);
    const visit = (await db.select().from(visits).where(and(eq(visits.id, input.visitId), eq(visits.labId, user.labId)))).at(0);
    if (!visit) return fail("Visit not found.");

    const entryIds = input.entries.map((e) => e.entryId);
    if (entryIds.length === 0) return fail("Nothing to save.");
    const entries = await db.select().from(resultEntries).where(and(inArray(resultEntries.id, entryIds), eq(resultEntries.labId, user.labId)));
    const entryById = new Map(entries.map((e) => [e.id, e]));

    const testIds = [...new Set(entries.map((e) => e.testId))];
    const testRows = await db.select().from(tests).where(inArray(tests.id, testIds));
    const testById = new Map(testRows.map((t) => [t.id, t]));
    const paramRows = await db.select().from(testParameters).where(inArray(testParameters.testId, testIds));
    const paramById = new Map(paramRows.map((p) => [p.id, p]));

    let touched = 0;
    for (const e of input.entries) {
      const entry = entryById.get(e.entryId);
      if (!entry) continue;
      if (entry.status === "approved" || entry.status === "dispatched") continue; // locked

      const test = testById.get(entry.testId);
      let entryAbnormal = false;
      let entryCritical = false;

      // Replace existing values.
      await db.delete(resultValues).where(eq(resultValues.resultEntryId, e.entryId));

      let order = 0;
      let anyValue = false;
      for (const v of e.values) {
        const raw = (v.value ?? "").trim();
        const param = v.parameterId ? paramById.get(v.parameterId) : null;
        const ref = param
          ? { refLow: param.refLow, refHigh: param.refHigh, criticalLow: param.criticalLow, criticalHigh: param.criticalHigh, refRangeText: param.refRangeText }
          : { refLow: test?.refLow, refHigh: test?.refHigh, criticalLow: test?.criticalLow, criticalHigh: test?.criticalHigh, refRangeText: test?.refRangeText };
        const unit = param?.unit ?? test?.unit ?? null;
        const num = raw === "" ? null : Number(raw);
        const isNumeric = num != null && !Number.isNaN(num);
        let flag: ResultFlag = "normal";
        if (isNumeric) flag = computeFlag(num, ref);
        if (raw !== "") anyValue = true;
        if (isAbnormal(flag)) entryAbnormal = true;
        if (isCritical(flag)) entryCritical = true;

        await db.insert(resultValues).values({
          resultEntryId: e.entryId,
          parameterId: v.parameterId,
          label: v.label,
          valueText: raw || null,
          valueNum: isNumeric ? num : null,
          unit,
          refText: refRangeText(ref),
          refLow: ref.refLow ?? null,
          refHigh: ref.refHigh ?? null,
          flag,
          displayOrder: order++,
        });
      }

      const newStatus = input.mode === "submit" ? "submitted" : "draft";
      const version = input.mode === "submit" ? entry.version + 1 : entry.version;

      await db
        .update(resultEntries)
        .set({
          status: newStatus,
          hasAbnormal: entryAbnormal,
          hasCritical: entryCritical,
          technicianRemarks: e.technicianRemarks ?? null,
          enteredBy: user.id,
          enteredByName: user.name,
          submittedAt: input.mode === "submit" ? new Date() : entry.submittedAt,
          correctionNote: input.mode === "submit" ? null : entry.correctionNote,
          version,
        })
        .where(eq(resultEntries.id, e.entryId));

      // Per-test status
      await db
        .update(visitTests)
        .set({ status: input.mode === "submit" ? "result_submitted" : "result_draft" })
        .where(eq(visitTests.id, entry.visitTestId));

      // Snapshot on submit
      if (input.mode === "submit" && anyValue) {
        const snap = await db.select().from(resultValues).where(eq(resultValues.resultEntryId, e.entryId));
        await db.insert(resultVersions).values({ resultEntryId: e.entryId, version, snapshot: snap, reason: "Submitted for approval", actorId: user.id, actorName: user.name });
      }
      touched++;
    }

    // Advance visit status.
    if (input.mode === "submit") {
      const remaining = await db
        .select({ n: resultEntries.id })
        .from(resultEntries)
        .where(and(eq(resultEntries.visitId, input.visitId), inArray(resultEntries.status, ["pending", "draft", "correction_required"] as never)));
      const newVisitStatus = remaining.length === 0 ? "awaiting_approval" : "result_pending";
      await db.update(visits).set({ status: newVisitStatus }).where(eq(visits.id, input.visitId));
    } else if (visit.status === "in_progress" || visit.status === "sample_pending") {
      await db.update(visits).set({ status: "result_pending" }).where(eq(visits.id, input.visitId));
    }

    await audit(user, "result.save", { entity: "visit", entityId: input.visitId, summary: `${input.mode === "submit" ? "Submitted" : "Saved draft"} results for ${visit.code} (${touched} test${touched > 1 ? "s" : ""})` });
    if (input.mode === "submit") await activity(user, "result_submitted", `Submitted results for ${visit.code}`, { entity: "visit", entityId: input.visitId });

    revalidatePath("/results");
    revalidatePath("/approval");
    revalidatePath(`/results/${input.visitId}`);
    return ok(undefined, input.mode === "submit" ? "Results submitted for approval" : "Draft saved");
  });
}
