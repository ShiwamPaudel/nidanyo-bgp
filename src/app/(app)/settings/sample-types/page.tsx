import { asc, eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/db/client";
import { sampleTypes } from "@/db/schema";
import { MastersManager } from "../masters-manager";

export const metadata = { title: "Sample Types" };

export default async function SampleTypesPage() {
  const me = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const rows = await db.select().from(sampleTypes).where(eq(sampleTypes.labId, me.labId)).orderBy(asc(sampleTypes.name));
  return <MastersManager kind="sampleType" hint="Specimen types used for collection (Blood, Serum, Urine…)." items={rows.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive, colorHex: r.colorHex }))} />;
}
