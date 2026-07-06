import Link from "next/link";
import { FlaskConical, AlertTriangle } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listResultQueue } from "@/lib/queries/results";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { fmtRelative } from "@/lib/datetime";

export const metadata = { title: "Result Entry" };

export default async function ResultsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.RESULT_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : "pending";
  const rows = await listResultQueue(user.labId, { q, status });

  return (
    <>
      <PageHeader title="Result Entry" description="Enter and submit test results for collected samples." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBar placeholder="Search visit, patient or phone…" />
        <FilterTabs
          param="status"
          options={[
            { value: "pending", label: "To do" },
            { value: "draft", label: "Drafts" },
            { value: "correction", label: "Corrections" },
            { value: "submitted", label: "Submitted" },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Nothing to enter" description="Results appear here once samples are collected." />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Visit</TH>
                <TH>Patient</TH>
                <TH>Tests</TH>
                <TH>Last updated</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.visitId}>
                  <TD>
                    <span className="font-medium">{r.visitCode}</span>
                    {r.priority === "urgent" && <Badge tone="danger" className="ml-2">Urgent</Badge>}
                    {r.hasCritical && (
                      <Badge tone="danger" className="ml-1"><AlertTriangle className="size-3" /> Critical</Badge>
                    )}
                  </TD>
                  <TD>
                    <span className="font-medium">{r.patientName}</span>
                    <span className="block text-xs text-muted-foreground">{r.patientCode} · {r.patientPhone ?? "—"}</span>
                  </TD>
                  <TD>
                    <Badge tone="neutral">{r.pending} pending</Badge>
                    <span className="ml-1 text-xs text-muted-foreground">of {r.total}</span>
                  </TD>
                  <TD className="text-muted-foreground">{fmtRelative(r.updatedAt ? new Date(Number(r.updatedAt) * 1000) : null)}</TD>
                  <TD className="text-right">
                    <Link href={`/results/${r.visitId}`} className={buttonVariants({ size: "sm" })}>Enter results</Link>
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
