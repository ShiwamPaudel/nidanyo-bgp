import "server-only";
import { db } from "@/db/client";
import { resultEntries, visits, patients, tests, testParameters, resultValues, samples, departments } from "@/db/schema";
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

  // Entries are presented department by department (Hematology, then
  // Biochemistry…) so the bench works through one discipline at a time and the
  // entry screen mirrors the printed report. Order follows the department's
  // configured displayOrder rather than the test name.
  const deptRows = await db.select().from(departments).where(eq(departments.labId, labId));
  const deptById = new Map(deptRows.map((d) => [d.id, d]));
  const deptOf = (testId: string) => {
    const t = testById.get(testId);
    return t?.departmentId ? deptById.get(t.departmentId) ?? null : null;
  };

  const ordered = [...entries].sort((a, b) => {
    const da = deptOf(a.testId);
    const dbb = deptOf(b.testId);
    // Tests with no department sink to the bottom.
    const oa = da?.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const ob = dbb?.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    const na = da?.name ?? "￿";
    const nb = dbb?.name ?? "￿";
    if (na !== nb) return na.localeCompare(nb);
    return a.testName.localeCompare(b.testName);
  });

  return {
    visit,
    patient,
    entries: ordered.map((e) => ({
      entry: e,
      test: testById.get(e.testId),
      department: deptOf(e.testId)?.name ?? null,
      params: paramsByTest.get(e.testId) ?? [],
      values: valuesByEntry.get(e.id) ?? [],
      sample: e.sampleId ? sampleById.get(e.sampleId) : undefined,
    })),
  };
}

/**
 * How many stored values on this visit were saved without a reference range
 * that the catalog could now supply. Drives whether the "Sync reference ranges"
 * button is worth showing — it stays hidden on the overwhelming majority of
 * visits, where nothing is missing.
 *
 * A value counts only when BOTH are true: nothing was captured on the value,
 * and the test/parameter now actually has a range to give.
 */
export async function countSyncableRanges(labId: string, visitId: string): Promise<number> {
  const rows = await db.all<{ n: number }>(sql`
    select count(*) as n
    from result_values rv
    join result_entries re on rv.result_entry_id = re.id
    left join tests t on re.test_id = t.id
    left join test_parameters tp on rv.parameter_id = tp.id
    where re.visit_id = ${visitId}
      and re.lab_id = ${labId}
      and rv.ref_low is null
      and rv.ref_high is null
      and (rv.ref_text is null or trim(rv.ref_text) in ('', '—', '-'))
      and case when rv.parameter_id is not null
        then (tp.ref_low is not null or tp.ref_high is not null or (tp.ref_range_text is not null and trim(tp.ref_range_text) <> ''))
        else (t.ref_low is not null or t.ref_high is not null or (t.ref_range_text is not null and trim(t.ref_range_text) <> ''))
      end
  `);
  return Number(rows[0]?.n ?? 0);
}

export interface AddableTest {
  id: string;
  name: string;
  departmentName: string | null;
  /** Set when this test belongs to a group the visit already ordered. */
  missingFromGroup: string | null;
}

/**
 * Active tests that could be added to a visit (i.e. not already ordered on it).
 *
 * `missingFromGroup` marks tests that belong to a group this visit DID order but
 * which the visit never got — the usual cause being that the group gained
 * members after the visit was created. Those are the ones staff are normally
 * hunting for, so the UI can surface them first.
 */
export async function getAddableTests(labId: string, visitId: string): Promise<AddableTest[]> {
  const rows = await db.all<{
    id: string;
    name: string;
    departmentName: string | null;
    missingFromGroup: string | null;
  }>(sql`
    select
      t.id   as id,
      t.name as name,
      d.name as departmentName,
      (
        select vt2.group_name from visit_tests vt2
        join test_group_items tgi on tgi.group_id = vt2.group_id and tgi.test_id = t.id
        where vt2.visit_id = ${visitId}
        limit 1
      ) as missingFromGroup
    from tests t
    left join departments d on t.department_id = d.id
    where t.lab_id = ${labId}
      and t.is_active = 1
      and t.id not in (select test_id from visit_tests where visit_id = ${visitId})
    order by t.name
  `);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    departmentName: r.departmentName ?? null,
    missingFromGroup: r.missingFromGroup ?? null,
  }));
}
