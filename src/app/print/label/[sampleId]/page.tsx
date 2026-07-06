import { notFound, redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getSampleForLabel } from "@/lib/queries/samples";
import { barcodeDataUrl } from "@/lib/barcode";
import { PrintToolbar } from "@/components/print/print-sheet";
import { ageLabel } from "@/lib/utils";
import { fmtDateTime } from "@/lib/datetime";

export const metadata = { title: "Sample label" };

export default async function LabelPrintPage({ params }: { params: Promise<{ sampleId: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.SAMPLE_VIEW)) redirect("/no-access");
  const { sampleId } = await params;
  const s = await getSampleForLabel(user.labId, sampleId);
  if (!s) notFound();
  const barcode = await barcodeDataUrl(s.code, { height: 9 });

  return (
    <div className="min-h-screen bg-[#eef1ee]">
      <PrintToolbar />
      <div className="flex justify-center py-8">
        {/* 50mm x 30mm style label */}
        <div className="print-sheet bg-white p-2 shadow-card" style={{ width: "70mm" }}>
          <div className="border border-[#0E1B14] p-2">
            <div className="text-[10px] leading-tight">
              <p className="font-semibold">{s.patientName}</p>
              <p>{s.patientCode} · {ageLabel(s.ageValue, s.ageUnit)}/{s.gender?.[0]?.toUpperCase()}</p>
              <p>{s.sampleTypeName}</p>
              <p>{s.visitCode} · {fmtDateTime(s.createdAt)}</p>
            </div>
            {barcode ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={barcode} alt={s.code} className="mt-1.5 block w-full" />
            ) : (
              <p className="mt-1.5 text-center text-[13px] font-bold tracking-wider">{s.code}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
