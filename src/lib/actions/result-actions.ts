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

/** A stored range counts as "missing" only when nothing was captured at all. */
function isRangeMissing(v: { refLow: number | null; refHigh: number | null; refText: string | null }): boolean {
  const text = (v.refText ?? "").trim();
  return v.refLow == null && v.refHigh == null && (text === "" || text === "—" || text === "-");
}

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

export interface RangeSyncPreviewItem {
  entryId: string;
  testName: string;
  label: string;
  value: string | null;
  newRef: string;
  oldFlag: ResultFlag;
  newFlag: ResultFlag;
}

/**
 * Report which stored values are missing a reference range that the catalog can
 * now supply, and what would change if they were filled in. Read-only.
 *
 * Ranges are deliberately snapshotted at entry time (a report must show the
 * range that was in force when it was validated), so this never runs on its
 * own — a human asks for it from the visit page.
 */
export async function previewReferenceRangeSync(visitId: string): Promise<
  ActionResult<{ items: RangeSyncPreviewItem[]; flagChanges: number }>
> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.APPROVAL_ACT);
    const items = await collectRangeSyncItems(user.labId, visitId);
    return ok({ items, flagChanges: items.filter((i) => i.oldFlag !== i.newFlag).length });
  });
}

/** Shared by preview + apply so the two can never disagree about what changes. */
async function collectRangeSyncItems(labId: string, visitId: string): Promise<RangeSyncPreviewItem[]> {
  const entries = await db
    .select()
    .from(resultEntries)
    .where(and(eq(resultEntries.visitId, visitId), eq(resultEntries.labId, labId)));
  if (entries.length === 0) return [];

  const values = await db
    .select()
    .from(resultValues)
    .where(inArray(resultValues.resultEntryId, entries.map((e) => e.id)));

  const testIds = [...new Set(entries.map((e) => e.testId))];
  const testRows = await db.select().from(tests).where(inArray(tests.id, testIds));
  const testById = new Map(testRows.map((t) => [t.id, t]));
  const paramRows = await db.select().from(testParameters).where(inArray(testParameters.testId, testIds));
  const paramById = new Map(paramRows.map((p) => [p.id, p]));
  const entryById = new Map(entries.map((e) => [e.id, e]));

  const out: RangeSyncPreviewItem[] = [];
  for (const v of values) {
    if (!isRangeMissing(v)) continue; // never overwrite a range that was really captured
    const entry = entryById.get(v.resultEntryId);
    if (!entry) continue;
    const test = testById.get(entry.testId);
    const param = v.parameterId ? paramById.get(v.parameterId) : null;
    const ref = param
      ? { refLow: param.refLow, refHigh: param.refHigh, criticalLow: param.criticalLow, criticalHigh: param.criticalHigh, refRangeText: param.refRangeText }
      : { refLow: test?.refLow, refHigh: test?.refHigh, criticalLow: test?.criticalLow, criticalHigh: test?.criticalHigh, refRangeText: test?.refRangeText };

    const newRef = refRangeText(ref);
    if (newRef === "—") continue; // catalog still has nothing to offer

    const newFlag = v.valueNum != null ? computeFlag(v.valueNum, ref) : "normal";
    out.push({
      entryId: entry.id,
      testName: entry.testName,
      label: v.label,
      value: v.valueText,
      newRef,
      oldFlag: v.flag as ResultFlag,
      newFlag,
    });
  }
  return out;
}

/**
 * Fill in reference ranges that were missing when the result was entered, using
 * the current catalog, and recompute each value's flag.
 *
 * Only touches values where NOTHING was captured — a range that was genuinely
 * recorded is never overwritten. Every affected entry gets a version bump, a
 * result_versions snapshot and an audit row, because filling a range can flip a
 * value from normal to H/L on a report that may already be with the patient.
 */
export async function syncReferenceRanges(visitId: string): Promise<ActionResult<{ updated: number; flagChanges: number }>> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.APPROVAL_ACT);
    const visit = (await db.select().from(visits).where(and(eq(visits.id, visitId), eq(visits.labId, user.labId)))).at(0);
    if (!visit) return fail("Visit not found.");

    const items = await collectRangeSyncItems(user.labId, visitId);
    if (items.length === 0) return fail("Nothing to sync — no result is missing a reference range that the catalog can supply.");

    const entries = await db
      .select()
      .from(resultEntries)
      .where(and(eq(resultEntries.visitId, visitId), eq(resultEntries.labId, user.labId)));
    const values = await db
      .select()
      .from(resultValues)
      .where(inArray(resultValues.resultEntryId, entries.map((e) => e.id)));
    const testIds = [...new Set(entries.map((e) => e.testId))];
    const testRows = await db.select().from(tests).where(inArray(tests.id, testIds));
    const testById = new Map(testRows.map((t) => [t.id, t]));
    const paramRows = await db.select().from(testParameters).where(inArray(testParameters.testId, testIds));
    const paramById = new Map(paramRows.map((p) => [p.id, p]));

    let updated = 0;
    let flagChanges = 0;
    const touchedEntryIds = new Set<string>();

    for (const entry of entries) {
      const test = testById.get(entry.testId);
      for (const v of values.filter((x) => x.resultEntryId === entry.id)) {
        if (!isRangeMissing(v)) continue;
        const param = v.parameterId ? paramById.get(v.parameterId) : null;
        const ref = param
          ? { refLow: param.refLow, refHigh: param.refHigh, criticalLow: param.criticalLow, criticalHigh: param.criticalHigh, refRangeText: param.refRangeText }
          : { refLow: test?.refLow, refHigh: test?.refHigh, criticalLow: test?.criticalLow, criticalHigh: test?.criticalHigh, refRangeText: test?.refRangeText };

        const newRef = refRangeText(ref);
        if (newRef === "—") continue;
        const newFlag: ResultFlag = v.valueNum != null ? computeFlag(v.valueNum, ref) : "normal";
        if (newFlag !== (v.flag as ResultFlag)) flagChanges++;

        await db
          .update(resultValues)
          .set({ refText: newRef, refLow: ref.refLow ?? null, refHigh: ref.refHigh ?? null, flag: newFlag })
          .where(eq(resultValues.id, v.id));
        updated++;
        touchedEntryIds.add(entry.id);
      }
    }

    if (updated === 0) return fail("Nothing to sync.");

    // Re-derive each touched entry's abnormal/critical rollup from its values,
    // bump the version and snapshot — the report's flags just changed.
    for (const entryId of touchedEntryIds) {
      const entry = entries.find((e) => e.id === entryId)!;
      const fresh = await db.select().from(resultValues).where(eq(resultValues.resultEntryId, entryId));
      const flags = fresh.map((f) => f.flag as ResultFlag);
      const version = entry.version + 1;
      await db
        .update(resultEntries)
        .set({
          hasAbnormal: flags.some(isAbnormal),
          hasCritical: flags.some(isCritical),
          version,
          updatedBy: user.id,
        })
        .where(eq(resultEntries.id, entryId));
      await db.insert(resultVersions).values({
        resultEntryId: entryId,
        version,
        snapshot: fresh,
        reason: "Reference ranges synced from catalog",
        actorId: user.id,
        actorName: user.name,
      });
    }

    await audit(user, "result.sync_ranges", {
      entity: "visit",
      entityId: visitId,
      summary: `Synced reference ranges for ${visit.code} — ${updated} value${updated === 1 ? "" : "s"} filled, ${flagChanges} flag change${flagChanges === 1 ? "" : "s"}`,
      meta: { updated, flagChanges, entries: [...touchedEntryIds] },
    });

    revalidatePath(`/visits/${visitId}`);
    revalidatePath(`/approval/${visitId}`);
    revalidatePath("/dispatch");
    return ok(
      { updated, flagChanges },
      flagChanges > 0
        ? `${updated} range${updated === 1 ? "" : "s"} filled — ${flagChanges} value${flagChanges === 1 ? "" : "s"} changed flag. Re-check the report before re-issuing.`
        : `${updated} range${updated === 1 ? "" : "s"} filled. No flags changed.`,
    );
  });
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
