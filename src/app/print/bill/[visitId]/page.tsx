import { notFound } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth/guard";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getVisitDetail } from "@/lib/queries/billing";
import { getLab, getLabAsset } from "@/lib/queries/lab";
import { reportUrl } from "@/lib/report-engine";
import { qrDataUrl } from "@/lib/qr";
import { PrintToolbar } from "@/components/print/print-sheet";
import { PrintHeader } from "@/components/print/letterhead";
import { money, ageLabel } from "@/lib/utils";
import { fmtDateTime, fmtDate } from "@/lib/datetime";

export const metadata = { title: "Bill" };

export default async function BillPrintPage({ params }: { params: Promise<{ visitId: string }> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.BILL_VIEW)) redirect("/no-access");
  const { visitId } = await params;
  const detail = await getVisitDetail(user.labId, visitId);
  if (!detail || !detail.bill) notFound();
  const { visit, patient, bill, items, payments, reportLink } = detail;

  const { lab, settings } = await getLab(user.labId);
  const headerAsset = await getLabAsset(user.labId, "bill_header").then((a) => a ?? getLabAsset(user.labId, "report_header"));
  const currency = settings?.currency ?? "NPR";

  const publicUrl = reportLink ? await reportUrl(reportLink.token, user.labId) : null;
  const qr = publicUrl ? await qrDataUrl(publicUrl, 132) : "";

  const labInfo = {
    name: lab?.name ?? "Laboratory",
    address: settings?.address,
    phone: settings?.phone,
    email: settings?.email,
    website: settings?.website,
    panVat: settings?.panVat,
  };

  const statusLine = bill.dueAmount > 0 ? "Payment pending — report available after full payment & approval." : "Paid — report will be available after approval.";

  return (
    <div className="min-h-screen bg-[#eef1ee]">
      <PrintToolbar />
      <div className="py-6">
        <div className="a4-sheet shadow-card print-sheet" style={{ padding: 0 }}>
          {/* Header image is placed flush to the page edges — the uploaded artwork already carries its own margins. */}
          {headerAsset?.url && <PrintHeader headerUrl={headerAsset.url} lab={labInfo} />}

          <div style={{ padding: headerAsset?.url ? `4mm ${settings?.reportMarginXMm ?? 12}mm 8mm` : `${settings?.reportMarginTopMm ?? 14}mm ${settings?.reportMarginXMm ?? 12}mm 8mm` }}>
          {!headerAsset?.url && <PrintHeader lab={labInfo} />}

          <div className="mt-3 text-center">
            <h2 className="inline-block rounded bg-brand-50 px-4 py-1 text-sm font-bold uppercase tracking-wide text-brand-700">Bill / Invoice</h2>
          </div>

          {/* Patient + meta */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-[12px]">
            <div className="space-y-0.5">
              <Line label="Patient" value={patient?.fullName} bold />
              <Line label="Patient ID" value={patient?.code} />
              <Line label="Age / Sex" value={`${ageLabel(patient?.ageValue, patient?.ageUnit)} / ${patient?.gender}`} />
              <Line label="Phone" value={patient?.phone ?? "—"} />
            </div>
            <div className="space-y-0.5 text-right">
              <Line label="Bill No" value={bill.code} align="right" bold />
              <Line label="Visit No" value={visit.code} align="right" />
              <Line label="Date" value={fmtDateTime(bill.createdAt)} align="right" />
              <Line label="Referred by" value={visit.referredBy ?? "—"} align="right" />
            </div>
          </div>

          {/* Items */}
          <table className="mt-4 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-y border-[#0E1B14]/15 bg-brand-50/60 text-left">
                <th className="py-1.5 pl-1">#</th>
                <th className="py-1.5">Description</th>
                <th className="py-1.5 pr-1 text-right">Amount ({currency})</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className="border-b border-[#DFE2E2]">
                  <td className="py-1.5 pl-1 align-top text-[#647067]">{i + 1}</td>
                  <td className="py-1.5">{it.label}{it.kind === "group" ? " (Profile)" : ""}</td>
                  <td className="py-1.5 pr-1 text-right tabular">{money(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-3 flex justify-end">
            <div className="w-64 space-y-1 text-[12px]">
              <Total label="Subtotal" value={money(bill.subtotal)} />
              {bill.discountAmount > 0 && <Total label="Discount" value={`- ${money(bill.discountAmount)}`} />}
              {bill.taxAmount > 0 && <Total label={`Tax (${bill.taxPercent}%)`} value={money(bill.taxAmount)} />}
              <div className="flex justify-between border-t border-[#0E1B14]/20 pt-1 text-[13px] font-bold">
                <span>Grand Total</span><span className="tabular">{money(bill.grandTotal)}</span>
              </div>
              <Total label="Paid" value={money(bill.paidAmount)} />
              <div className="flex justify-between font-semibold" style={{ color: bill.dueAmount > 0 ? "#FF3131" : "#075323" }}>
                <span>Due</span><span className="tabular">{money(bill.dueAmount)}</span>
              </div>
            </div>
          </div>

          {/* Payment history */}
          {payments.length > 0 && (
            <div className="mt-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#647067]">Payment history</p>
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-[#DFE2E2] text-left text-[#647067]">
                    <th className="py-1">Receipt</th><th>Date</th><th>Mode</th><th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-[#F0F2F0]">
                      <td className="py-1">{p.code}</td>
                      <td>{fmtDate(p.paidAt)}</td>
                      <td>{p.mode}</td>
                      <td className="text-right tabular">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* QR + status */}
          <div className="mt-5 flex items-end justify-between gap-4 rounded-lg border border-[#DFE2E2] bg-[#F8FAF8] p-3">
            <div className="text-[11px]">
              <p className="font-semibold text-brand-700">Track your report</p>
              <p className="text-[#647067]">Scan the QR or visit the link to check status & download once ready.</p>
              {publicUrl && <p className="mt-1 break-all text-info">{publicUrl}</p>}
              <p className="mt-1 font-medium" style={{ color: bill.dueAmount > 0 ? "#FF3131" : "#075323" }}>{statusLine}</p>
            </div>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Report QR" className="size-[88px] shrink-0" />
            )}
          </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value, bold, align }: { label: string; value?: string | null; bold?: boolean; align?: "right" }) {
  return (
    <p className={align === "right" ? "text-right" : ""}>
      <span className="text-[#647067]">{label}: </span>
      <span className={bold ? "font-semibold" : ""}>{value || "—"}</span>
    </p>
  );
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[#344054]">
      <span>{label}</span><span className="tabular">{value}</span>
    </div>
  );
}
