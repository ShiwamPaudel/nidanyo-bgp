import Link from "next/link";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listApprovalQueue } from "@/lib/queries/approval";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { fmtRelative } from "@/lib/datetime";

export const metadata = { title: "Approval" };

export default async function ApprovalPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.APPROVAL_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const rows = await listApprovalQueue(user.labId, { q });

  return (
    <>
      <PageHeader title="Result Approval" description="Review submitted results, approve and sign, or send back for correction." />
      <div className="mb-4"><SearchBar placeholder="Search visit, patient or phone…" /></div>

      {rows.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing to approve" description="Submitted results will appear here for review." />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Visit</TH>
                <TH>Patient</TH>
                <TH>Tests</TH>
                <TH>Flags</TH>
                <TH>Submitted</TH>
                <TH className="text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.visitId}>
                  <TD>
                    <span className="font-medium">{r.visitCode}</span>
                    {r.priority === "urgent" && <Badge tone="danger" className="ml-2">Urgent</Badge>}
                  </TD>
                  <TD>
                    <span className="font-medium">{r.patientName}</span>
                    <span className="block text-xs text-muted-foreground">{r.patientCode}</span>
                  </TD>
                  <TD><Badge tone="neutral">{r.submitted}</Badge></TD>
                  <TD>
                    {r.hasCritical ? <Badge tone="danger"><AlertTriangle className="size-3" /> Critical</Badge> : r.hasAbnormal ? <Badge tone="warning">Abnormal</Badge> : <Badge tone="success">Normal</Badge>}
                  </TD>
                  <TD className="text-muted-foreground">{fmtRelative(r.submittedAt ? new Date(Number(r.submittedAt) * 1000) : null)}</TD>
                  <TD className="text-right">
                    <Link href={`/approval/${r.visitId}`} className={buttonVariants({ size: "sm" })}>Review</Link>
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
