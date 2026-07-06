import { eq, asc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/db/client";
import { paymentModes } from "@/db/schema";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NewModeButton, ToggleModeButton } from "./mode-manager";

export const metadata = { title: "Payment Modes" };

export default async function PaymentModesPage() {
  const me = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const rows = await db.select().from(paymentModes).where(eq(paymentModes.labId, me.labId)).orderBy(asc(paymentModes.displayOrder));

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Payment methods available when receiving payments.</p>
        <NewModeButton />
      </div>
      <TableWrap>
        <Table>
          <THead><TR><TH>Name</TH><TH>Category</TH><TH>Status</TH><TH className="text-right">Action</TH></TR></THead>
          <TBody>
            {rows.map((m) => (
              <TR key={m.id}>
                <TD className="font-medium">{m.name}</TD>
                <TD className="capitalize text-muted-foreground">{m.category}</TD>
                <TD>{m.isActive ? <Badge tone="success">Enabled</Badge> : <Badge tone="neutral">Disabled</Badge>}</TD>
                <TD className="text-right"><ToggleModeButton id={m.id} active={m.isActive} /></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </TableWrap>
    </>
  );
}
