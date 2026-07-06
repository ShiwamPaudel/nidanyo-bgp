import { Send, CheckCircle2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listReports } from "@/lib/queries/dispatch";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
import { fmtRelative } from "@/lib/datetime";
import { DispatchActions } from "./dispatch-actions";

export const metadata = { title: "Dispatch" };

export default async function DispatchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.DISPATCH_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : "ready";
  const rows = await listReports(user.labId, { q, status });

  return (
    <>
      <PageHeader title="Report Dispatch" description="Deliver approved reports and track how each was shared." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBar placeholder="Search visit, patient or phone…" />
        <FilterTabs param="status" options={[{ value: "ready", label: "Ready" }, { value: "dispatched", label: "Dispatched" }, { value: "all", label: "All" }]} />
      </div>

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
                <TH>SMS</TH>
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
                  <TD>{r.smsCount > 0 ? <Badge tone="success">{r.smsCount} sent</Badge> : <Badge tone="neutral">—</Badge>}</TD>
                  <TD className="tabular text-muted-foreground">{r.viewCount ?? 0}</TD>
                  <TD className="text-muted-foreground">{fmtRelative(r.updatedAt)}</TD>
                  <TD>
                    <DispatchActions visitId={r.visitId} token={r.linkActive ? r.token : null} hasEmail={!!r.patientEmail} hasPhone={!!r.patientPhone} />
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
