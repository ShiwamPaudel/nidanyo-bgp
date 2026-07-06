"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { patients } from "@/db/schema";
import { authorize } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { nextCode } from "@/lib/numbering";
import { ActionResult, ok, fail, run } from "@/lib/action";
import { audit, activity } from "@/lib/audit";
import { patientSchema, type PatientInput } from "@/lib/validators/patient";

function clean<T extends Record<string, unknown>>(input: T) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) out[k] = v === "" ? null : v;
  return out;
}

export async function createPatient(input: PatientInput): Promise<ActionResult<{ id: string; code: string }>> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.PATIENT_MANAGE);
    const parsed = patientSchema.safeParse(clean(input));
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
      return fail("Please check the highlighted fields.", fe);
    }
    const d = parsed.data;
    const code = await nextCode(user.labId, "patient");
    const [row] = await db
      .insert(patients)
      .values({
        labId: user.labId,
        code,
        fullName: d.fullName,
        gender: d.gender,
        ageValue: d.ageValue ?? null,
        ageUnit: d.ageUnit,
        dob: d.dob ? new Date(d.dob) : null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        address: d.address ?? null,
        referredBy: d.referredBy ?? null,
        notes: d.notes ?? null,
        createdBy: user.id,
      })
      .returning({ id: patients.id, code: patients.code });

    await audit(user, "patient.create", { entity: "patient", entityId: row.id, summary: `Registered ${d.fullName} (${code})` });
    await activity(user, "patient_registered", `Registered patient ${d.fullName} (${code})`, { entity: "patient", entityId: row.id });
    revalidatePath("/patients");
    return ok(row, "Patient registered successfully");
  });
}

export async function updatePatient(id: string, input: PatientInput): Promise<ActionResult> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.PATIENT_MANAGE);
    const parsed = patientSchema.safeParse(clean(input));
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0])] = i.message;
      return fail("Please check the highlighted fields.", fe);
    }
    const existing = (await db.select().from(patients).where(and(eq(patients.id, id), eq(patients.labId, user.labId)))).at(0);
    if (!existing) return fail("Patient not found.");
    const d = parsed.data;
    await db
      .update(patients)
      .set({
        fullName: d.fullName,
        gender: d.gender,
        ageValue: d.ageValue ?? null,
        ageUnit: d.ageUnit,
        dob: d.dob ? new Date(d.dob) : null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        address: d.address ?? null,
        referredBy: d.referredBy ?? null,
        notes: d.notes ?? null,
        updatedBy: user.id,
      })
      .where(eq(patients.id, id));
    await audit(user, "patient.update", { entity: "patient", entityId: id, summary: `Updated ${d.fullName}` });
    revalidatePath(`/patients/${id}`);
    revalidatePath("/patients");
    return ok(undefined, "Patient details updated");
  });
}

/**
 * Returning-patient suggestions — match by phone or name. Used live during
 * registration to avoid duplicate records.
 */
export async function searchPatientsSuggest(query: string): Promise<
  ActionResult<{ id: string; code: string; fullName: string; phone: string | null; gender: string; ageValue: number | null; ageUnit: string | null; visits: number }[]>
> {
  return run(async () => {
    const user = await authorize(PERMISSIONS.PATIENT_VIEW);
    const q = query.trim();
    if (q.length < 2) return ok([]);
    const term = `%${q}%`;
    const rows = await db
      .select({
        id: patients.id,
        code: patients.code,
        fullName: patients.fullName,
        phone: patients.phone,
        gender: patients.gender,
        ageValue: patients.ageValue,
        ageUnit: patients.ageUnit,
        visits: sql<number>`(select count(*) from visits where visits.patient_id = ${patients.id})`,
      })
      .from(patients)
      .where(
        and(
          eq(patients.labId, user.labId),
          eq(patients.isActive, true),
          or(like(patients.fullName, term), like(patients.phone, term), like(patients.code, term)),
        ),
      )
      .orderBy(desc(patients.createdAt))
      .limit(8);
    return ok(rows.map((r) => ({ ...r, visits: Number(r.visits) })));
  });
}
