import Link from "next/link";
import { FileText, Printer, Eye, Lock } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listReports } from "@/lib/queries/dispatch";
import { getLab } from "@/lib/queries/lab";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { DateRangeFilter } from "@/components/ui/date-range";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { fmtRelative } from "@/lib/datetime";
import { todayISO } from "@/lib/utils";
import { ReportTestPicker } from "./report-test-picker";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.REPORT_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  // Default to today's reports when browsing; a search spans all dates unless a range is set.
  const from = typeof sp.from === "string" ? sp.from : q ? undefined : todayISO();
  const to = typeof sp.to === "string" ? sp.to : q ? undefined : todayISO();
  const [rows, { settings }] = await Promise.all([
    // includePartial: also surface visits with at least one approved test (not
    // fully done yet) so the completed tests can be printed and handed over.
    listReports(user.labId, { q, status: "all", from, to, includePartial: true }),
    getLab(user.labId),
  ]);
  // Only admins may print reports that still carry a due, when the lab opts in.
  const isAdmin = hasPermission(user, PERMISSIONS.SETTINGS_MANAGE);
  const restrictDuePrint = settings?.restrictDuePrint ?? false;

  return (
    <>
      <PageHeader title="Reports" description="Approved laboratory reports. Print the full report or selected tests, view, or open the secure patient link." />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBar placeholder="Search visit, patient or phone…" />
        <DateRangeFilter cal={(settings?.calendarSystem as "AD" | "BS") ?? "AD"} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={FileText} title="No reports yet" description="Approved reports will appear here." />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Visit</TH>
                <TH>Patient</TH>
                <TH>Status</TH>
                <TH>Link</TH>
                <TH>Updated</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.visitId}>
                  <TD className="font-medium">{r.visitCode}</TD>
                  <TD>
                    <span className="font-medium">{r.patientName}</span>
                    <span className="block text-xs text-muted-foreground">{r.patientCode}</span>
                  </TD>
                  <TD><StatusChip status={r.status} /></TD>
                  <TD>{r.linkActive ? <Badge tone="success">Active</Badge> : <Badge tone="warning">Inactive</Badge>}</TD>
                  <TD className="text-muted-foreground">{fmtRelative(r.updatedAt)}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      {restrictDuePrint && !isAdmin && (r.dueAmount ?? 0) > 0 ? (
                        <span className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Printing blocked — due unpaid" title="Payment due — only an admin can print this report"><Lock className="size-4 text-amber-600" /></span>
                      ) : (
                        <>
                          <a href={`/print/report/${r.visitId}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Print full report" title="Print full report"><Printer className="size-4" /></a>
                          <ReportTestPicker visitId={r.visitId} visitCode={r.visitCode} />
                        </>
                      )}
                      {r.linkActive && r.token && (
                        <a href={`/r/${r.token}`} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Open public link"><Eye className="size-4" /></a>
                      )}
                      <Link href={`/visits/${r.visitId}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Visit"><FileText className="size-4" /></Link>
                    </div>
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
