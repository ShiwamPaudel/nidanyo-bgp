import { eq, desc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/db/client";
import { emailLogs } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/feedback";
import { fmtDateTime } from "@/lib/datetime";
import { EmailTest } from "./email-test";

export const metadata = { title: "Email" };

export default async function EmailSettingsPage() {
  const me = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const provider = process.env.EMAIL_PROVIDER || "mock";
  const from = process.env.EMAIL_FROM || "Nidanyo <no-reply@nidanyo.local>";
  const configured = provider !== "mock";
  const logs = await db.select().from(emailLogs).where(eq(emailLogs.labId, me.labId)).orderBy(desc(emailLogs.createdAt)).limit(25);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Email provider</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">Provider:</span>
            <Badge tone={configured ? "success" : "warning"}>{provider}</Badge>
            <span className="text-muted-foreground">From:</span>
            <Badge tone="neutral">{from}</Badge>
          </div>
          {!configured ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Email is in preview mode — messages are logged but not delivered. To enable real email, set an email provider (Resend, SendGrid, or a custom endpoint) in your environment configuration and restart the app.
            </p>
          ) : (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Email is configured. Patients with an email address receive their report link automatically once the report is ready and paid.
            </p>
          )}
          <EmailTest />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent emails</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <EmptyState title="No emails yet" description="Sent emails will appear here." />
          ) : (
            <TableWrap>
              <Table>
                <THead><TR><TH>When</TH><TH>To</TH><TH>Subject</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {logs.map((l) => (
                    <TR key={l.id}>
                      <TD className="text-muted-foreground">{fmtDateTime(l.createdAt)}</TD>
                      <TD className="tabular">{l.toEmail}</TD>
                      <TD className="text-muted-foreground">{l.subject}</TD>
                      <TD><StatusChip status={l.status} /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
