import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listTransactions, getTestRevenue, getEodSummary, getSalesInRange } from "@/lib/queries/finance";
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

  const [{ dayRows, dayTotal, dueRows, dueTotal }, sales, testRev, eod, { lab, settings }] = await Promise.all([
    listTransactions(user.labId, { from, to, mode: get("mode"), q: get("q") }),
    getSalesInRange(user.labId, from, to),
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

          {/* Sales — one row per bill RAISED in this range, regardless of when
              (or whether) it was collected. This is the day's true sales. */}
          <div className="mt-4">
            <h3 className="inline-block rounded bg-brand-50 px-3 py-0.5 text-[12px] font-bold uppercase tracking-wide text-brand-700">Sales — Bills Raised (This Period)</h3>
            <table className="mt-2 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-y border-[#0E1B14]/15 bg-brand-50/60 text-left">
                  <th className="py-1.5 pl-1">Visit</th>
                  <th className="py-1.5">Date</th>
                  <th className="py-1.5">Patient</th>
                  <th className="py-1.5">Referred by</th>
                  <th className="py-1.5 text-right">Gross Sales</th>
                  <th className="py-1.5 text-right">Discount</th>
                  <th className="py-1.5 text-right">Tax</th>
                  <th className="py-1.5 text-right">Net Sales</th>
                  <th className="py-1.5 text-right">Collected</th>
                  <th className="py-1.5 pr-1 text-right">Due</th>
                </tr>
              </thead>
              <tbody>
                {sales.rows.map((r) => (
                  <tr key={r.billCode} className="border-b border-[#DFE2E2]">
                    <td className="py-1 pl-1">{r.visitCode}</td>
                    <td className="py-1">{fmtDateTime(r.createdAt)}</td>
                    <td className="py-1">{r.patientName}</td>
                    <td className="py-1">{r.referredBy ?? "Walk-in"}</td>
                    <td className="py-1 text-right tabular">{money(r.subtotal)}</td>
                    <td className="py-1 text-right tabular">{money(r.discount)}</td>
                    <td className="py-1 text-right tabular">{money(r.tax)}</td>
                    <td className="py-1 text-right tabular">{money(r.grandTotal)}</td>
                    <td className="py-1 text-right tabular">{money(r.paidAmount)}</td>
                    <td className="py-1 pr-1 text-right tabular">{money(r.dueAmount)}</td>
                  </tr>
                ))}
                {sales.rows.length === 0 && (
                  <tr><td colSpan={10} className="py-3 text-center text-[#647067]">No bills raised in this range.</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#0E1B14]/20 font-bold">
                  <td className="py-1.5 pl-1" colSpan={4}>{sales.rows.length} {sales.rows.length === 1 ? "bill" : "bills"}</td>
                  <td className="py-1.5 text-right tabular">{money(sales.totals.gross)}</td>
                  <td className="py-1.5 text-right tabular">{money(sales.totals.discount)}</td>
                  <td className="py-1.5 text-right tabular">{money(sales.totals.tax)}</td>
                  <td className="py-1.5 text-right tabular">{money(sales.totals.net)}</td>
                  <td className="py-1.5 text-right tabular" colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
            <p className="mt-1 text-[10px] text-[#647067]">Collected / Due reflect the bill&rsquo;s current status. Money is recorded on the day it is received — see the collection tables below.</p>
          </div>

          {/* Collections — money actually received in this range (by payment date) */}
          <div className="mt-6">
            <TransactionsTable
              title="Collections Received (This Period's Bills)"
              rows={dayRows}
              total={dayTotal}
              emptyText="No payments against this period's bills."
            />
          </div>

          {/* Dues settled today against bills raised on an earlier day */}
          <div className="mt-6">
            <TransactionsTable
              title="Dues Collected Today (Previous Days' Bills)"
              rows={dueRows}
              total={dueTotal}
              emptyText="No previous-day dues collected in this range."
            />
          </div>

          {/* Tests performed — profiles rolled up, standalone tests on their own */}
          <div className="mt-6 break-inside-avoid">
            <h3 className="inline-block rounded bg-brand-50 px-3 py-0.5 text-[12px] font-bold uppercase tracking-wide text-brand-700">Tests Performed</h3>
            <table className="mt-2 w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-y border-[#0E1B14]/15 bg-brand-50/60 text-left">
                  <th className="py-1.5 pl-1">Test / Profile</th>
                  <th className="py-1.5">Type</th>
                  <th className="py-1.5 text-right">Times</th>
                  <th className="py-1.5 pr-1 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {testRev.map((t) => (
                  <tr key={`${t.kind}-${t.name}`} className="border-b border-[#DFE2E2]">
                    <td className="py-1 pl-1">{t.name}</td>
                    <td className="py-1 text-[#647067]">{t.kind === "group" ? "Profile" : "Test"}</td>
                    <td className="py-1 text-right tabular">{t.count}</td>
                    <td className="py-1 pr-1 text-right tabular">{money(t.revenue)}</td>
                  </tr>
                ))}
                {testRev.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-[#647067]">No tests performed in this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

type TxnRow = {
  id: string;
  code: string;
  paidAt: Date;
  amount: number;
  mode: string;
  kind: string;
  receivedByName: string | null;
  visitCode: string;
  patientName: string;
  referredBy: string | null;
};

function TransactionsTable({ title, rows, total, emptyText }: { title: string; rows: TxnRow[]; total: number; emptyText: string }) {
  return (
    <div className="break-inside-avoid">
      <h3 className="inline-block rounded bg-brand-50 px-3 py-0.5 text-[12px] font-bold uppercase tracking-wide text-brand-700">{title}</h3>
      <table className="mt-2 w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-y border-[#0E1B14]/15 bg-brand-50/60 text-left">
            <th className="py-1.5 pl-1">Receipt</th>
            <th className="py-1.5">Visit</th>
            <th className="py-1.5">Date</th>
            <th className="py-1.5">Patient</th>
            <th className="py-1.5">Referred by</th>
            <th className="py-1.5">Mode</th>
            <th className="py-1.5">Type</th>
            <th className="py-1.5">Received by</th>
            <th className="py-1.5 pr-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-[#DFE2E2]">
              <td className="py-1 pl-1">{r.code}</td>
              <td className="py-1">{r.visitCode}</td>
              <td className="py-1">{fmtDateTime(r.paidAt)}</td>
              <td className="py-1">{r.patientName}</td>
              <td className="py-1">{r.referredBy ?? "Walk-in"}</td>
              <td className="py-1">{r.mode}</td>
              <td className="py-1 capitalize">{r.kind === "due_collection" ? "Due Collection" : r.kind}</td>
              <td className="py-1">{r.receivedByName ?? ""}</td>
              <td className="py-1 pr-1 text-right tabular">{r.kind === "refund" ? "-" : ""}{money(r.amount)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={9} className="py-3 text-center text-[#647067]">{emptyText}</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-[#0E1B14]/20 font-bold">
            <td className="py-1.5 pl-1" colSpan={8}>{rows.length} {rows.length === 1 ? "transaction" : "transactions"}</td>
            <td className="py-1.5 pr-1 text-right tabular">{money(total)}</td>
          </tr>
        </tfoot>
      </table>
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
