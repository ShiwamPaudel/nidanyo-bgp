import { eq, desc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/db/client";
import { auditLogs } from "@/db/schema";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { fmtDateTime } from "@/lib/datetime";

export const metadata = { title: "Audit Log" };

export default async function AuditPage() {
  const me = await requirePermission(PERMISSIONS.AUDIT_VIEW);
  const rows = await db.select().from(auditLogs).where(eq(auditLogs.labId, me.labId)).orderBy(desc(auditLogs.createdAt)).limit(200);

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">A record of sensitive actions across the system, for accountability.</p>
      {rows.length === 0 ? (
        <EmptyState title="No audit entries" description="Sensitive actions will be recorded here." />
      ) : (
        <TableWrap>
          <Table>
            <THead><TR><TH>When</TH><TH>User</TH><TH>Action</TH><TH>Details</TH></TR></THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">{fmtDateTime(r.createdAt)}</TD>
                  <TD className="font-medium">{r.actorName ?? "System"}</TD>
                  <TD><Badge tone="neutral">{r.action}</Badge></TD>
                  <TD className="text-muted-foreground">{r.summary ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
