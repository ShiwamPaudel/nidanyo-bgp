import { and, eq, asc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getOrderableCatalog, getPaymentModes } from "@/lib/queries/catalog";
import { getPatient } from "@/lib/queries/patients";
import { getLab } from "@/lib/queries/lab";
import { db } from "@/db/client";
import { referringDoctors } from "@/db/schema";
import { PageHeader } from "@/components/ui/page";
import { VisitBillingForm } from "./visit-billing-form";

export const metadata = { title: "New visit" };

export default async function NewVisitPage({ searchParams }: { searchParams: Promise<{ patient?: string }> }) {
  const user = await requirePermission(PERMISSIONS.VISIT_CREATE);
  const sp = await searchParams;
  const [catalog, modes, { settings }, doctors] = await Promise.all([
    getOrderableCatalog(user.labId),
    getPaymentModes(user.labId),
    getLab(user.labId),
    db.select().from(referringDoctors).where(and(eq(referringDoctors.labId, user.labId), eq(referringDoctors.isActive, true))).orderBy(asc(referringDoctors.name)),
  ]);
  const preselected = sp.patient ? await getPatient(user.labId, sp.patient) : null;

  return (
    <>
      <PageHeader title="New patient & visit" description="Register a new patient or pick an existing one, then add tests and collect payment — all in one step." />
      <VisitBillingForm
        catalog={catalog}
        modes={modes.map((m) => ({ id: m.id, name: m.name }))}
        doctors={doctors.map((d) => ({ id: d.id, name: d.name }))}
        currency={settings?.currency ?? "NPR"}
        taxPercent={settings?.taxEnabled ? settings.taxPercent : 0}
        preselectedPatient={
          preselected
            ? { id: preselected.id, code: preselected.code, fullName: preselected.fullName, phone: preselected.phone, gender: preselected.gender, ageValue: preselected.ageValue, ageUnit: preselected.ageUnit }
            : null
        }
      />
    </>
  );
}
