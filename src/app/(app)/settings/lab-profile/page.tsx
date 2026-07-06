import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getLab } from "@/lib/queries/lab";
import { LabProfileForm } from "./profile-form";

export const metadata = { title: "Lab Profile" };

export default async function LabProfilePage() {
  const user = await requirePermission(PERMISSIONS.SETTINGS_VIEW);
  const { lab, settings } = await getLab(user.labId);

  return (
    <LabProfileForm
      initial={{
        name: lab?.name ?? "",
        address: settings?.address ?? "",
        phone: settings?.phone ?? "",
        email: settings?.email ?? "",
        website: settings?.website ?? "",
        panVat: settings?.panVat ?? "",
        calendarSystem: (settings?.calendarSystem as "AD" | "BS") ?? "AD",
        currency: settings?.currency ?? "NPR",
        taxEnabled: settings?.taxEnabled ?? false,
        taxPercent: settings?.taxPercent ?? 0,
        shortLinkBaseUrl: settings?.shortLinkBaseUrl ?? "",
        reportMarginTopMm: settings?.reportMarginTopMm ?? 14,
        reportMarginBottomMm: settings?.reportMarginBottomMm ?? 14,
        reportMarginXMm: settings?.reportMarginXMm ?? 12,
        requirePhoneVerification: settings?.requirePhoneVerification ?? false,
      }}
    />
  );
}
