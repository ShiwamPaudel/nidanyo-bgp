import "server-only";
import { db } from "@/db/client";
import { samples, visits, patients, visitTests } from "@/db/schema";
import { and, desc, eq, like, or, sql, ne } from "drizzle-orm";

export async function listSamples(labId: string, opts: { q?: string; status?: string } = {}) {
  const term = opts.q?.trim() ? `%${opts.q.trim()}%` : null;
  const conds = [eq(samples.labId, labId), ne(visits.status, "cancelled")];
  if (opts.status && opts.status !== "all") conds.push(eq(samples.status, opts.status as never));
  else conds.push(sql`${samples.status} in ('waiting','collected','rejected','recollection')`);
  if (term) conds.push(or(like(samples.code, term), like(visits.code, term), like(patients.fullName, term), like(patients.phone, term))!);

  const rows = await db
    .select({
      id: samples.id,
      code: samples.code,
      status: samples.status,
      sampleTypeName: samples.sampleTypeName,
      collectedAt: samples.collectedAt,
      collectedByName: samples.collectedByName,
      rejectionReason: samples.rejectionReason,
      visitId: samples.visitId,
      visitCode: visits.code,
      priority: visits.priority,
      patientName: patients.fullName,
      patientCode: patients.code,
      patientPhone: patients.phone,
      createdAt: samples.createdAt,
      // Tests riding on THIS specimen (a visit can have one sample per type),
      // so the collector sees exactly what this tube is for. Cancelled tests are
      // excluded — nobody should be drawing for them.
      testCount: sql<number>`(
        select count(*) from visit_tests
        where visit_tests.visit_id = ${samples.visitId}
          and visit_tests.sample_type_id = ${samples.sampleTypeId}
          and visit_tests.status <> 'cancelled'
      )`,
      // Billed profiles read as the profile ("CBC"), not as their member
      // analytes ("DC, Neutrophils…") — same coalesce(group, test) convention
      // the dashboard and reports use. Distinct collapses a group's members
      // into one chip. Ordered inside a subquery: SQLite's group_concat has no
      // guaranteed ordering of its own, and an unstable list would be jarring.
      testNames: sql<string | null>`(
        select group_concat(label, ', ') from (
          select distinct coalesce(visit_tests.group_name, visit_tests.test_name) as label
          from visit_tests
          where visit_tests.visit_id = ${samples.visitId}
            and visit_tests.sample_type_id = ${samples.sampleTypeId}
            and visit_tests.status <> 'cancelled'
          order by label
        )
      )`,
    })
    .from(samples)
    .innerJoin(visits, eq(samples.visitId, visits.id))
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .where(and(...conds))
    .orderBy(desc(samples.createdAt))
    .limit(200);

  return rows.map((r) => ({ ...r, testCount: Number(r.testCount) }));
}

export async function getSampleForLabel(labId: string, sampleId: string) {
  const rows = await db
    .select({
      id: samples.id,
      code: samples.code,
      sampleTypeName: samples.sampleTypeName,
      visitCode: visits.code,
      patientName: patients.fullName,
      patientCode: patients.code,
      gender: patients.gender,
      ageValue: patients.ageValue,
      ageUnit: patients.ageUnit,
      createdAt: samples.createdAt,
    })
    .from(samples)
    .innerJoin(visits, eq(samples.visitId, visits.id))
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .where(and(eq(samples.id, sampleId), eq(samples.labId, labId)));
  return rows.at(0) ?? null;
}
