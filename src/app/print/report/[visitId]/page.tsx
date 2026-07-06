import { notFound, redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getReportData } from "@/lib/queries/report";
import { reportUrl } from "@/lib/report-engine";
import { qrDataUrl } from "@/lib/qr";
import { type ReportEntry } from "@/components/print/report-sheet";
import { ReportPrintView } from "./report-print-view";

export const metadata = { title: "Report" };

export default async function ReportPrintPage({ params }: { params: Promise<{ visitId: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.REPORT_VIEW)) redirect("/no-access");
  const { visitId } = await params;
  const data = await getReportData(user.labId, visitId);
  if (!data || data.entries.length === 0) notFound();

  const publicUrl = data.link ? await reportUrl(data.link.token, user.labId) : null;
  const qr = publicUrl ? await qrDataUrl(publicUrl, 120) : "";

  return (
    <ReportPrintView
      lab={{ name: data.lab?.name ?? "Laboratory", address: data.settings?.address, phone: data.settings?.phone, email: data.settings?.email, website: data.settings?.website, panVat: data.settings?.panVat }}
      headerUrl={data.headerUrl}
      footerUrl={data.footerUrl}
      marginTopMm={data.settings?.reportMarginTopMm ?? 14}
      marginXMm={data.settings?.reportMarginXMm ?? 12}
      patient={{ fullName: data.patient!.fullName, code: data.patient!.code, gender: data.patient!.gender, ageValue: data.patient!.ageValue, ageUnit: data.patient!.ageUnit, phone: data.patient!.phone, referredBy: data.patient!.referredBy }}
      visit={{ code: data.visit.code, referredBy: data.visit.referredBy, visitDate: data.visit.visitDate }}
      entries={data.entries as unknown as ReportEntry[]}
      signatories={data.signatories}
      qrDataUrl={qr}
      publicUrl={publicUrl}
      cal={(data.settings?.calendarSystem as "AD" | "BS") ?? "AD"}
    />
  );
}
