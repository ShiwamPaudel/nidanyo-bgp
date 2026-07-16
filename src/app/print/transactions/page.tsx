import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listTransactions, getTestRevenue, getEodSummary } from "@/lib/queries/finance";
import { getLab } from "@/lib/queries/lab";
import { PrintToolbar } from "@/components/print/print-sheet";
import { money } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "@/lib/datetime";

export const metadata = { title: "Transactions Export" };

export default async function TransactionsPrintPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  if (!hasPermission(user, PERMISSIONS.FINANCE_EXPORT)) redirect("/no-access");
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const from = get("from");
  const to = get("to");

  const [{ rows, total }, testRev, eod, { lab, settings }] = await Promise.all([
    listTransactions(user.labId, { from, to, mode: get("mode"), q: get("q") }),
    getTestRevenue(user.labId, from, to),
    getEodSummary(user.labId, from, to),
    getLab(user.labId),
  ]);
  const rangeStart = from ? new Date(from) : new Date();
  const rangeEnd = to ? new Date(to) : rangeStart;
  const rangeLabel = `${fmtDate(rangeStart)} – ${fmtDate(rangeEnd)}`;

  return (
    <div className="min-h-screen bg-[#eef1ee]">
      {/* Landscape override — this export has wide tables. */}
      <style>{"@media print{@page{size:A4 landscape;margin:0}}"}</style>
      <PrintToolbar />
      <div className="py-6">
        <div className="mx-auto bg-white text-[#0e1b14] shadow-card print-sheet" style={{ width: "297mm", minHeight: "210mm", padding: "10mm 12mm" }}>
          {/* Internal finance document — no letterhead artwork. A plain text
              line identifies the lab; the uploaded header/footer are reserved
              for patient-facing bills and reports. */}
          <div className="flex items-end justify-between border-b border-[#0E1B14]/15 pb-2">
            <p className="text-[13px] font-bold text-[#0e1b14]">{lab?.name ?? "Laboratory"}</p>
            {settings?.panVat && <p className="text-[11px] text-[#647067]">PAN/VAT: {settings.panVat}</p>}
          </div>

          <div className="mt-3 flex items-end justify-between">
            <div>
              <h2 className="inline-block rounded bg-brand-50 px-4 py-1 text-sm font-bold uppercase tracking-wide text-brand-700">Transactions Report</h2>
              <p className="mt-1 text-[12px] text-[#647067]">Date range: {rangeLabel}</p>
            </div>
            <div className="text-right text-[11px] text-[#647067]">
              <p>Printed by <span className="font-medium text-[#0e1b14]">{user.name}</span></p>
              <p>Printed at {fmtDateTime(new Date())}</p>
            </div>
          </div>

          {/* Summary strip */}
          <div className="mt-3 grid grid-cols-4 gap-3 rounded border border-[#DFE2E2] bg-[#F8FAF8] p-2 text-[11px]">
            <Metric label="Net collected" value={money(eod.net)} />
            <Metric label="Discounts given" value={money(eod.discount)} />
            <Metric label="Due collected" value={money(eod.dueCollected)} />
            <Metric label="Refunds" value={money(eod.refunded)} />
          </div>

          {/* Transactions */}
          <table className="mt-4 w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-y border-[#0E1B14]/15 bg-brand-50/60 text-left">
                <th className="py-1.5 pl-1">Receipt</th>
                <th className="py-1.5">Date</th>
                <th className="py-1.5">Patient</th>
                <th className="py-1.5">Bill</th>
                <th className="py-1.5">Mode</th>
                <th className="py-1.5">Type</th>
                <th className="py-1.5">Reference</th>
                <th className="py-1.5">Received by</th>
                <th className="py-1.5 pr-1 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#DFE2E2]">
                  <td className="py-1 pl-1">{r.code}</td>
                  <td className="py-1">{fmtDateTime(r.paidAt)}</td>
                  <td className="py-1">{r.patientName}</td>
                  <td className="py-1">{r.billCode}</td>
                  <td className="py-1">{r.mode}</td>
                  <td className="py-1 capitalize">{r.kind === "due_collection" ? "Due Collection" : r.kind}</td>
                  <td className="py-1">{r.reference ?? ""}</td>
                  <td className="py-1">{r.receivedByName ?? ""}</td>
                  <td className="py-1 pr-1 text-right tabular">{r.kind === "refund" ? "-" : ""}{money(r.amount)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="py-3 text-center text-[#647067]">No transactions in this range.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#0E1B14]/20 font-bold">
                <td className="py-1.5 pl-1" colSpan={8}>Net collected ({rows.length} transactions)</td>
                <td className="py-1.5 pr-1 text-right tabular">{money(total)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Tests performed */}
          <div className="mt-6 break-inside-avoid">
            <h3 className="inline-block rounded bg-brand-50 px-3 py-0.5 text-[12px] font-bold uppercase tracking-wide text-brand-700">Tests Performed</h3>
            <table className="mt-2 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-y border-[#0E1B14]/15 bg-brand-50/60 text-left">
                  <th className="py-1.5 pl-1">Test</th>
                  <th className="py-1.5 text-right">Times</th>
                  <th className="py-1.5 pr-1 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {testRev.map((t) => (
                  <tr key={t.name} className="border-b border-[#DFE2E2]">
                    <td className="py-1 pl-1">{t.name}</td>
                    <td className="py-1 text-right tabular">{t.count}</td>
                    <td className="py-1 pr-1 text-right tabular">{money(t.revenue)}</td>
                  </tr>
                ))}
                {testRev.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-center text-[#647067]">No tests performed in this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[#647067]">{label}</p>
      <p className="font-semibold tabular text-[#0e1b14]">{value}</p>
    </div>
  );
}
