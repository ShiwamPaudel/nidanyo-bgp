import { eq, desc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/db/client";
import { smsLogs } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusChip } from "@/components/ui/status-chip";
import { EmptyState } from "@/components/ui/feedback";
import { fmtDateTime } from "@/lib/datetime";
import { SMS_ENABLED } from "@/lib/messaging";
import { SmsTest } from "./sms-test";

export const metadata = { title: "SMS" };

export default async function SmsSettingsPage() {
  const me = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const provider = process.env.SMS_PROVIDER || "mock";
  const senderId = process.env.SMS_SENDER_ID || "Nidanyo";
  const configured = SMS_ENABLED;
  const logs = await db.select().from(smsLogs).where(eq(smsLogs.labId, me.labId)).orderBy(desc(smsLogs.createdAt)).limit(25);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>SMS provider</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">Provider:</span>
            <Badge tone={configured ? "success" : "warning"}>{provider}</Badge>
            <span className="text-muted-foreground">Sender ID:</span>
            <Badge tone="neutral">{senderId}</Badge>
          </div>
          {!configured ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              SMS is turned off. Nothing is sent to patients and no new entries are recorded below. Past messages are kept. To turn it on, set the provider credentials in your environment configuration and restart the app.
            </p>
          ) : (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              SMS is configured. Patients automatically receive a message when their report is ready and the payment is cleared.
            </p>
          )}
          {configured && <SmsTest />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent messages</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <EmptyState title="No messages yet" description="Sent messages will appear here." />
          ) : (
            <TableWrap>
              <Table>
                <THead><TR><TH>When</TH><TH>To</TH><TH>Purpose</TH><TH>Status</TH></TR></THead>
                <TBody>
                  {logs.map((l) => (
                    <TR key={l.id}>
                      <TD className="text-muted-foreground">{fmtDateTime(l.createdAt)}</TD>
                      <TD className="tabular">{l.toPhone}</TD>
                      <TD className="capitalize text-muted-foreground">{l.purpose.replace("_", " ")}</TD>
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
