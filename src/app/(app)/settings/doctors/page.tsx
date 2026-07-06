import { asc, eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/db/client";
import { referringDoctors } from "@/db/schema";
import { MastersManager } from "../masters-manager";

export const metadata = { title: "Referring Doctors" };

export default async function DoctorsPage() {
  const me = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const rows = await db.select().from(referringDoctors).where(eq(referringDoctors.labId, me.labId)).orderBy(asc(referringDoctors.name));
  return (
    <MastersManager
      kind="doctor"
      hint="Maintain referring doctors so reception can pick them on each visit."
      items={rows.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive, qualification: r.qualification, clinic: r.clinic, phone: r.phone, commissionPercent: r.commissionPercent }))}
    />
  );
}
