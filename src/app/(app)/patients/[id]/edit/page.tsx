import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getPatient } from "@/lib/queries/patients";
import { PageHeader } from "@/components/ui/page";
import { PatientForm } from "../../patient-form";

export const metadata = { title: "Edit patient" };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.PATIENT_MANAGE);
  const { id } = await params;
  const patient = await getPatient(user.labId, id);
  if (!patient) notFound();

  return (
    <>
      <PageHeader title={`Edit ${patient.fullName}`} description={`Patient ID ${patient.code}`} />
      <PatientForm
        mode="edit"
        patientId={id}
        initial={{
          fullName: patient.fullName,
          gender: patient.gender,
          ageValue: patient.ageValue,
          ageUnit: (patient.ageUnit as "years" | "months" | "days") ?? "years",
          dob: patient.dob ? new Date(patient.dob).toISOString().slice(0, 10) : "",
          phone: patient.phone,
          email: patient.email,
          address: patient.address,
          referredBy: patient.referredBy,
          notes: patient.notes,
        }}
      />
    </>
  );
}
