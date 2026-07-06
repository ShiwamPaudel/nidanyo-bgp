import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { PageHeader } from "@/components/ui/page";
import { PatientForm } from "../patient-form";

export const metadata = { title: "Register patient" };

export default async function NewPatientPage() {
  await requirePermission(PERMISSIONS.PATIENT_MANAGE);
  return (
    <>
      <PageHeader title="Register patient" description="Add a new patient to your laboratory directory." />
      <PatientForm mode="create" />
    </>
  );
}
