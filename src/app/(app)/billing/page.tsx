import Link from "next/link";
import { Plus, ReceiptText, Eye } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listVisits } from "@/lib/queries/billing";
import { getLab } from "@/lib/queries/lab";
import { PageHeader } from "@/components/ui/page";
import { buttonVariants } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";
import { DateRangeFilter } from "@/components/ui/date-range";
import { Pagination } from "@/components/ui/pagination";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { money, todayISO } from "@/lib/utils";
import { fmtDate } from "@/lib/datetime";

export const metadata = { title: "Visits & Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.BILL_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const payment = typeof sp.payment === "string" ? sp.payment : "all";
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;
  // Default to today's visits when browsing; a search spans all dates unless a range is set.
  const from = typeof sp.from === "string" ? sp.from : q ? undefined : todayISO();
  const to = typeof sp.to === "string" ? sp.to : q ? undefined : todayISO();
  const { rows, total, pageSize } = await listVisits(user.labId, { q, payment, from, to, page });
  const { settings } = await getLab(user.labId);
  const currency = settings?.currency ?? "NPR";
  const canCreate = hasPermission(user, PERMISSIONS.VISIT_CREATE);

  return (
    <>
      <PageHeader
        title="Visits & Billing"
        description="All visits and their bills. Open a visit to take payment, print, or manage tests."
        actions={
          canCreate && (
            <Link href="/visits/new" className={buttonVariants()}>
              <Plus className="size-4" /> New visit
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBar placeholder="Search visit, bill, patient or phone…" />
        <div className="flex flex-wrap items-center gap-3">
          <FilterTabs
            param="payment"
            options={[
              { value: "all", label: "All" },
              { value: "unpaid", label: "Unpaid" },
              { value: "partial", label: "Partial" },
              { value: "paid", label: "Paid" },
            ]}
          />
          <DateRangeFilter cal={(settings?.calendarSystem as "AD" | "BS") ?? "AD"} />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No visits found"
          description={q ? "Try a different search." : "Create a visit to start billing."}
          action={canCreate && !q ? <Link href="/visits/new" className={buttonVariants({ size: "sm" })}><Plus className="size-4" /> New visit</Link> : undefined}
        />
      ) : (
        <>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Visit</TH>
                  <TH>Patient</TH>
                  <TH>Date</TH>
                  <TH>Status</TH>
                  <TH>Payment</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Due</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((v) => (
                  <TR key={v.id}>
                    <TD>
                      <Link href={`/visits/${v.id}`} className="font-medium hover:text-brand-700 hover:underline">{v.code}</Link>
                      {v.priority === "urgent" && <Badge tone="danger" className="ml-2">Urgent</Badge>}
                    </TD>
                    <TD>
                      <span className="font-medium">{v.patientName}</span>
                      <span className="block text-xs text-muted-foreground">{v.patientCode} · {v.patientPhone ?? "—"}</span>
                    </TD>
                    <TD className="text-muted-foreground">{fmtDate(v.visitDate)}</TD>
                    <TD><StatusChip status={v.billStatus === "cancelled" ? "cancelled" : v.status} /></TD>
                    <TD>{v.paymentStatus ? <StatusChip status={v.paymentStatus} /> : "—"}</TD>
                    <TD className="text-right tabular">{currency} {money(v.grandTotal ?? 0)}</TD>
                    <TD className="text-right tabular">
                      {(v.dueAmount ?? 0) > 0 ? <span className="font-medium text-destructive">{money(v.dueAmount ?? 0)}</span> : <span className="text-muted-foreground">0.00</span>}
                    </TD>
                    <TD className="text-right">
                      <Link href={`/visits/${v.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Open"><Eye className="size-4" /></Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <Pagination page={page} pageSize={pageSize} total={total} searchParams={sp} basePath="/billing" />
        </>
      )}
    </>
  );
}
