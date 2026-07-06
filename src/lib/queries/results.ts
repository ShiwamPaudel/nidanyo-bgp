import "server-only";
import { db } from "@/db/client";
import { resultEntries, visits, patients, tests, testParameters, resultValues, samples } from "@/db/schema";
import { and, asc, desc, eq, inArray, like, or, sql, ne } from "drizzle-orm";

/**
 * Queue grouped by visit: visits that have at least one result entry needing
 * work (pending/draft/correction) AND whose sample is collected.
 */
export async function listResultQueue(labId: string, opts: { q?: string; status?: string } = {}) {
  const statusFilter =
    opts.status === "submitted"
      ? ["submitted"]
      : opts.status === "draft"
        ? ["draft"]
        : opts.status === "correction"
          ? ["correction_required"]
          : ["pending", "draft", "correction_required"];

  const term = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const conds = [eq(resultEntries.labId, labId), inArray(resultEntries.status, statusFilter as never), ne(visits.status, "cancelled")];
  if (term) conds.push(or(like(visits.code, term), like(patients.fullName, term), like(patients.phone, term))!);

  const rows = await db
    .select({
      visitId: resultEntries.visitId,
      visitCode: visits.code,
      priority: visits.priority,
      patientName: patients.fullName,
      patientCode: patients.code,
      patientPhone: patients.phone,
      total: sql<number>`count(*)`,
      pending: sql<number>`sum(case when ${resultEntries.status} in ('pending','draft','correction_required') then 1 else 0 end)`,
      hasCritical: sql<number>`max(${resultEntries.hasCritical})`,
      updatedAt: sql<number>`max(${resultEntries.updatedAt})`,
    })
    .from(resultEntries)
    .innerJoin(visits, eq(resultEntries.visitId, visits.id))
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .where(and(...conds))
    .groupBy(resultEntries.visitId)
    .orderBy(desc(sql`max(${resultEntries.updatedAt})`))
    .limit(200);

  return rows.map((r) => ({ ...r, total: Number(r.total), pending: Number(r.pending), hasCritical: Number(r.hasCritical) > 0 }));
}

/** Full entry data for a visit's result entry screen. */
export async function getVisitResults(labId: string, visitId: string) {
  const visit = (await db.select().from(visits).where(and(eq(visits.id, visitId), eq(visits.labId, labId)))).at(0);
  if (!visit) return null;
  const patient = (await db.select().from(patients).where(eq(patients.id, visit.patientId))).at(0);

  const entries = await db
    .select()
    .from(resultEntries)
    .where(eq(resultEntries.visitId, visitId))
    .orderBy(asc(resultEntries.testName));

  const testIds = entries.map((e) => e.testId);
  const paramRows = testIds.length
    ? await db.select().from(testParameters).where(inArray(testParameters.testId, testIds)).orderBy(asc(testParameters.displayOrder))
    : [];
  const testRows = testIds.length ? await db.select().from(tests).where(inArray(tests.id, testIds)) : [];
  const entryIds = entries.map((e) => e.id);
  const valueRows = entryIds.length ? await db.select().from(resultValues).where(inArray(resultValues.resultEntryId, entryIds)) : [];
  const sampleRows = await db.select().from(samples).where(eq(samples.visitId, visitId));

  const paramsByTest = new Map<string, typeof paramRows>();
  for (const p of paramRows) {
    const arr = paramsByTest.get(p.testId) ?? [];
    arr.push(p);
    paramsByTest.set(p.testId, arr);
  }
  const testById = new Map(testRows.map((t) => [t.id, t]));
  const valuesByEntry = new Map<string, typeof valueRows>();
  for (const v of valueRows) {
    const arr = valuesByEntry.get(v.resultEntryId) ?? [];
    arr.push(v);
    valuesByEntry.set(v.resultEntryId, arr);
  }
  const sampleById = new Map(sampleRows.map((s) => [s.id, s]));

  return {
    visit,
    patient,
    entries: entries.map((e) => ({
      entry: e,
      test: testById.get(e.testId),
      params: paramsByTest.get(e.testId) ?? [],
      values: valuesByEntry.get(e.id) ?? [],
      sample: e.sampleId ? sampleById.get(e.sampleId) : undefined,
    })),
  };
}
