import { Banknote, Download, FileText } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listTransactions } from "@/lib/queries/finance";
import { getLab } from "@/lib/queries/lab";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { DateRangeFilter } from "@/components/ui/date-range";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { money, formatMoney } from "@/lib/utils";
import { fmtDateTime } from "@/lib/datetime";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.TRANSACTIONS_VIEW);
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const { rows, total } = await listTransactions(user.labId, { from: get("from"), to: get("to"), mode: get("mode"), q: get("q") });
  const { settings } = await getLab(user.labId);
  const currency = settings?.currency ?? "NPR";
  const canExport = hasPermission(user, PERMISSIONS.FINANCE_EXPORT);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  const excelUrl = `/api/export/transactions?${qs}`;
  const pdfUrl = `/print/transactions?${qs}`;

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every payment recorded, with running totals."
        actions={canExport && (
          <>
            <a href={excelUrl} className={buttonVariants({ variant: "outline" })}><Download className="size-4" /> Export Excel</a>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}><FileText className="size-4" /> Export PDF</a>
          </>
        )}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBar placeholder="Search receipt, bill or patient…" />
        <DateRangeFilter cal={(settings?.calendarSystem as "AD" | "BS") ?? "AD"} />
      </div>

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Net collected (range)</p><p className="text-2xl font-bold text-brand-700 tabular">{formatMoney(total, currency)}</p></CardContent></Card>
        <Card><CardContent className="pt-5"><p className="text-sm text-muted-foreground">Transactions</p><p className="text-2xl font-bold tabular">{rows.length}</p></CardContent></Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Banknote} title="No transactions" description="Adjust the date range or filters to see payments." />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Receipt</TH>
                <TH>Date</TH>
                <TH>Patient</TH>
                <TH>Referred by</TH>
                <TH>Bill</TH>
                <TH>Mode</TH>
                <TH>Type</TH>
                <TH>Received by</TH>
                <TH className="text-right">Amount</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium">{r.code}</TD>
                  <TD className="text-muted-foreground">{fmtDateTime(r.paidAt)}</TD>
                  <TD>{r.patientName}</TD>
                  <TD className="text-muted-foreground">{r.referredBy ?? "Walk-in"}</TD>
                  <TD className="text-muted-foreground">{r.billCode}</TD>
                  <TD>{r.mode}</TD>
                  <TD>{r.kind === "refund" ? <Badge tone="danger">Refund</Badge> : r.kind === "due_collection" ? <Badge tone="info">Due</Badge> : <Badge tone="neutral">Payment</Badge>}</TD>
                  <TD className="text-muted-foreground">{r.receivedByName ?? "—"}</TD>
                  <TD className={`text-right tabular font-medium ${r.kind === "refund" ? "text-destructive" : ""}`}>{r.kind === "refund" ? "-" : ""}{money(r.amount)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
