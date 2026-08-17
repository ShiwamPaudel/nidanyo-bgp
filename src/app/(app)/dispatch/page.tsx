import { Send, CheckCircle2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listReports, REPORTS_PAGE_LIMIT } from "@/lib/queries/dispatch";
import { getLab } from "@/lib/queries/lab";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { DateRangeFilter } from "@/components/ui/date-range";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
import { fmtRelative } from "@/lib/datetime";
import { todayISO } from "@/lib/utils";
import { SMS_ENABLED, EMAIL_ENABLED } from "@/lib/messaging";
import { DispatchActions } from "./dispatch-actions";

export const metadata = { title: "Dispatch" };

export default async function DispatchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.DISPATCH_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : "ready";
  // "Ready" is a live work queue — a report approved three weeks ago is still
  // waiting to be handed over, so it must never be hidden behind a date
  // default. The historical tabs mirror the Reports page and start at today,
  // with the same range filter to look further back. A search always spans all
  // dates, again matching Reports.
  const historical = status !== "ready";
  const from = typeof sp.from === "string" ? sp.from : historical && !q ? todayISO() : undefined;
  const to = typeof sp.to === "string" ? sp.to : historical && !q ? todayISO() : undefined;

  const [{ rows, hasMore }, { settings }] = await Promise.all([
    listReports(user.labId, { q, status, from, to }),
    getLab(user.labId),
  ]);

  return (
    <>
      <PageHeader title="Report Dispatch" description="Deliver approved reports and track how each was shared." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBar placeholder="Search visit, patient or phone…" />
        <div className="flex flex-wrap items-center gap-3">
          <FilterTabs param="status" options={[{ value: "ready", label: "Ready" }, { value: "dispatched", label: "Dispatched" }, { value: "all", label: "All" }]} />
          {historical && <DateRangeFilter cal={(settings?.calendarSystem as "AD" | "BS") ?? "AD"} />}
        </div>
      </div>

      {hasMore && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Showing the {REPORTS_PAGE_LIMIT} most recently updated reports. Narrow the date range or search to see the rest.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={status === "ready" ? CheckCircle2 : Send} title={status === "ready" ? "Nothing to dispatch" : "No reports"} description={status === "ready" ? "Approved & paid reports appear here for delivery." : "No reports match this filter."} />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Visit</TH>
                <TH>Patient</TH>
                <TH>Report</TH>
                <TH>Views</TH>
                <TH>When</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.visitId}>
                  <TD className="font-medium">{r.visitCode}</TD>
                  <TD>
                    <span className="font-medium">{r.patientName}</span>
                    <span className="block text-xs text-muted-foreground">{r.patientCode} · {r.patientPhone ?? "—"}</span>
                  </TD>
                  <TD>
                    {r.linkActive ? <StatusChip status={r.status === "dispatched" ? "dispatched" : "approved"} /> : <Badge tone="warning">Awaiting payment</Badge>}
                  </TD>
                  <TD className="tabular text-muted-foreground">{r.viewCount ?? 0}</TD>
                  <TD className="text-muted-foreground">{fmtRelative(r.updatedAt)}</TD>
                  <TD>
                    <DispatchActions visitId={r.visitId} token={r.linkActive ? r.token : null} hasEmail={!!r.patientEmail} hasPhone={!!r.patientPhone} smsEnabled={SMS_ENABLED} emailEnabled={EMAIL_ENABLED} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
