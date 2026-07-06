import { asc, or, eq, isNull } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/db/client";
import { roles } from "@/db/schema";
import { RoleEditor } from "./role-editor";

export const metadata = { title: "Roles" };

export default async function RolesPage() {
  const me = await requirePermission(PERMISSIONS.ROLES_MANAGE);
  const roleRows = await db
    .select()
    .from(roles)
    .where(or(eq(roles.labId, me.labId), isNull(roles.labId)))
    .orderBy(asc(roles.name));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Define what each role can access. Changes apply to all users with that role.</p>
      {roleRows
        .filter((r) => r.key !== "super_admin")
        .map((r) => (
          <RoleEditor
            key={r.id}
            role={{ id: r.id, name: r.name, key: r.key, description: r.description, permissions: (r.permissions as string[]) ?? [], isAdmin: r.key === "lab_admin" }}
          />
        ))}
    </div>
  );
}
