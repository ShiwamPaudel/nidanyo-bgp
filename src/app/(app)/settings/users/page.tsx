import { eq, asc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/db/client";
import { users, roles } from "@/db/schema";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { initials } from "@/lib/utils";
import { fmtRelative } from "@/lib/datetime";
import { NewUserButton, EditUserButton, ToggleUserButton } from "./user-manager";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const [userRows, roleRows] = await Promise.all([
    db.select().from(users).where(eq(users.labId, me.labId)).orderBy(asc(users.name)),
    db.select().from(roles).orderBy(asc(roles.name)),
  ]);
  const roleById = new Map(roleRows.map((r) => [r.id, r.name]));
  const roleOpts = roleRows.filter((r) => r.key !== "super_admin").map((r) => ({ id: r.id, name: r.name }));

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{userRows.length} staff account{userRows.length === 1 ? "" : "s"}</p>
        <NewUserButton roles={roleOpts} />
      </div>

      {userRows.length === 0 ? (
        <EmptyState title="No users" description="Add your first staff account." />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR><TH>User</TH><TH>Role</TH><TH>Designation</TH><TH>Last login</TH><TH>Status</TH><TH className="text-right">Actions</TH></TR>
            </THead>
            <TBody>
              {userRows.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-8 items-center justify-center rounded-full bg-brand-700 text-xs font-semibold text-white">{initials(u.name)}</span>
                      <div>
                        <p className="font-medium">{u.name} {u.id === me.id && <span className="text-xs text-muted-foreground">(you)</span>}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD><Badge tone="brand">{roleById.get(u.roleId) ?? u.roleKey}</Badge></TD>
                  <TD className="text-muted-foreground">{u.designation ?? "—"}</TD>
                  <TD className="text-muted-foreground">{u.lastLoginAt ? fmtRelative(u.lastLoginAt) : "Never"}</TD>
                  <TD>{u.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Disabled</Badge>}</TD>
                  <TD>
                    <div className="flex items-center justify-end gap-1">
                      <ToggleUserButton userId={u.id} active={u.isActive} isSelf={u.id === me.id} />
                      <EditUserButton user={{ id: u.id, name: u.name, email: u.email, phone: u.phone, roleId: u.roleId, designation: u.designation, registrationNo: u.registrationNo }} roles={roleOpts} />
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
