import "server-only";
import { db } from "@/db/client";
import {
  visits,
  patients,
  resultEntries,
  resultValues,
  reportLinks,
  reportDispatches,
  bills,
  reportSignatories,
  departments,
  tests,
} from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getLab, getLabAsset } from "@/lib/queries/lab";

/** Full data needed to render a final report (approved results only). */
export async function getReportData(labId: string, visitId: string) {
  const visit = (await db.select().from(visits).where(and(eq(visits.id, visitId), eq(visits.labId, labId)))).at(0);
  if (!visit) return null;
  const patient = (await db.select().from(patients).where(eq(patients.id, visit.patientId))).at(0);
  const bill = (await db.select().from(bills).where(eq(bills.visitId, visitId))).at(0);

  const entries = await db
    .select()
    .from(resultEntries)
    .where(and(eq(resultEntries.visitId, visitId), eq(resultEntries.status, "approved")))
    .orderBy(asc(resultEntries.testName));

  const entryIds = entries.map((e) => e.id);
  const values = entryIds.length
    ? await db.select().from(resultValues).where(inArray(resultValues.resultEntryId, entryIds)).orderBy(asc(resultValues.displayOrder))
    : [];
  const valuesByEntry = new Map<string, typeof values>();
  for (const v of values) {
    const arr = valuesByEntry.get(v.resultEntryId) ?? [];
    arr.push(v);
    valuesByEntry.set(v.resultEntryId, arr);
  }

  // Department names for grouping
  const testIds = [...new Set(entries.map((e) => e.testId))];
  const testRows = testIds.length ? await db.select().from(tests).where(inArray(tests.id, testIds)) : [];
  const deptRows = await db.select().from(departments).where(eq(departments.labId, labId));
  const deptById = new Map(deptRows.map((d) => [d.id, d.name]));
  const deptByTest = new Map(testRows.map((t) => [t.id, t.departmentId ? deptById.get(t.departmentId) ?? null : null]));
  const noteByTest = new Map(testRows.map((t) => [t.id, t.description ?? null]));
  const methodByTest = new Map(testRows.map((t) => [t.id, t.method ?? null]));

  // Report signatories — admin-managed, shown at the end of the report,
  // independent of who approved the results.
  const signatories = await db
    .select()
    .from(reportSignatories)
    .where(and(eq(reportSignatories.labId, labId), eq(reportSignatories.isActive, true)))
    .orderBy(asc(reportSignatories.displayOrder), asc(reportSignatories.createdAt));

  const { lab, settings } = await getLab(labId);
  const [headerAsset, footerAsset] = await Promise.all([
    getLabAsset(labId, "report_header"),
    getLabAsset(labId, "report_footer"),
  ]);
  const link = (await db.select().from(reportLinks).where(eq(reportLinks.visitId, visitId))).at(0);
  const dispatches = await db.select().from(reportDispatches).where(eq(reportDispatches.visitId, visitId));

  return {
    visit,
    patient,
    bill,
    lab,
    settings,
    headerUrl: headerAsset?.url ?? null,
    footerUrl: footerAsset?.url ?? null,
    signatories: signatories.map((s) => ({ id: s.id, name: s.name, description: s.description, url: s.url })),
    link,
    dispatches,
    entries: entries.map((e) => ({
      entry: e,
      values: valuesByEntry.get(e.id) ?? [],
      department: deptByTest.get(e.testId) ?? null,
      note: noteByTest.get(e.testId) ?? null,
      method: methodByTest.get(e.testId) ?? null,
    })),
  };
}
