import { FileText, Download, TrendingUp, Wallet } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getEodSummary, getTestRevenue, getOutstandingDuesTotal } from "@/lib/queries/finance";
import { getLab } from "@/lib/queries/lab";
import { PageHeader } from "@/components/ui/page";
import { DateRangeFilter } from "@/components/ui/date-range";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatCard } from "@/components/dashboard/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { money, formatMoney } from "@/lib/utils";
import { fmtDate } from "@/lib/datetime";

export const metadata = { title: "Financial Reports" };

export default async function FinancialReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.FINANCE_REPORTS_VIEW);
  const sp = await searchParams;
  const from = typeof sp.from === "string" ? sp.from : undefined;
  const to = typeof sp.to === "string" ? sp.to : undefined;
  const [eod, testRev, outstanding, { settings }] = await Promise.all([
    getEodSummary(user.labId, from, to),
    getTestRevenue(user.labId, from, to),
    getOutstandingDuesTotal(user.labId),
    getLab(user.labId),
  ]);
  const currency = settings?.currency ?? "NPR";
  const canExport = hasPermission(user, PERMISSIONS.FINANCE_EXPORT);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]).toString();
  const excelUrl = `/api/export/transactions?${qs}`;
  const pdfUrl = `/print/transactions?${qs}`;
  const rangeLabel = `${fmtDate(eod.range.start)} – ${fmtDate(eod.range.end)}`;

  return (
    <>
      <PageHeader
        title="Financial Reports"
        description={`End-of-day & revenue summary · ${rangeLabel}`}
        actions={canExport && (
          <>
            <a href={excelUrl} className={buttonVariants({ variant: "outline" })}><Download className="size-4" /> Export Excel</a>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}><FileText className="size-4" /> Export PDF</a>
          </>
        )}
      />

      <div className="mb-4"><DateRangeFilter cal={(settings?.calendarSystem as "AD" | "BS") ?? "AD"} /></div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total billed" value={formatMoney(eod.billed, currency)} sub={`${eod.billCount} bills`} icon={TrendingUp} tone="brand" />
        <StatCard label="Net collected" value={formatMoney(eod.net, currency)} sub={`Refunds ${money(eod.refunded)}`} icon={Wallet} tone="info" />
        <StatCard label="Due generated" value={formatMoney(eod.dueGenerated, currency)} tone="warning" />
        <StatCard label="Due collected" value={formatMoney(eod.dueCollected, currency)} tone="brand" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>EOD breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Cash collected" value={money(eod.cash)} />
            <Row label="Digital / QR / wallet" value={money(eod.digital)} />
            <Row label="Card" value={money(eod.card)} />
            <Row label="Discounts given" value={money(eod.discount)} />
            <Row label="Refunds" value={money(eod.refunded)} />
            <Row label="Cancelled bills" value={`${eod.cancelledCount} · ${money(eod.cancelledAmount)}`} />
            <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Net collection</span><span className="tabular text-brand-700">{money(eod.net)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Collection by mode</CardTitle></CardHeader>
          <CardContent>
            {eod.byMode.length === 0 ? <EmptyState title="No collection" description="Nothing collected in this range." /> : (
              <div className="space-y-2 text-sm">
                {eod.byMode.map((m) => <Row key={m.mode} label={m.mode} value={money(m.total)} />)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Collection by user</CardTitle></CardHeader>
          <CardContent>
            {eod.byUser.length === 0 ? <EmptyState title="No collection" description="No user collections in this range." /> : (
              <div className="space-y-2 text-sm">
                {eod.byUser.map((u) => (
                  <div key={u.user} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{u.user} <span className="text-xs">({u.count})</span></span>
                    <span className="font-medium tabular">{money(u.total)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Test-wise revenue & frequency</CardTitle></CardHeader>
          <CardContent>
            {testRev.length === 0 ? <EmptyState title="No tests" description="No tests ordered in this range." /> : (
              <TableWrap>
                <Table>
                  <THead><TR><TH>Test / Profile</TH><TH>Type</TH><TH className="text-right">Times</TH><TH className="text-right">Revenue</TH></TR></THead>
                  <TBody>
                    {testRev.slice(0, 20).map((t) => (
                      <TR key={`${t.kind}-${t.name}`}>
                        <TD className="font-medium">{t.name}</TD>
                        <TD className="text-muted-foreground">{t.kind === "group" ? "Profile" : "Test"}</TD>
                        <TD className="text-right tabular">{t.count}</TD>
                        <TD className="text-right tabular">{money(t.revenue)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Outstanding dues</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive tabular">{formatMoney(outstanding.total, currency)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{outstanding.count} unpaid / partially paid bills (all time)</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular">{value}</span></div>;
}
