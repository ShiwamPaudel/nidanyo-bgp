import { Layers } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listGroupsAdmin } from "@/lib/queries/catalog-admin";
import { getDepartments, getOrderableCatalog } from "@/lib/queries/catalog";
import { getLab } from "@/lib/queries/lab";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/utils";
import { NewGroupButton, EditGroupButton, ToggleGroupButton } from "./group-manager";

export const metadata = { title: "Test Groups" };

export default async function TestGroupsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.CATALOG_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const [rows, departments, catalog, { settings }] = await Promise.all([
    listGroupsAdmin(user.labId, q),
    getDepartments(user.labId),
    getOrderableCatalog(user.labId),
    getLab(user.labId),
  ]);
  const canManage = hasPermission(user, PERMISSIONS.CATALOG_MANAGE);
  const deptOpts = departments.map((d) => ({ id: d.id, name: d.name }));
  const testOpts = catalog.tests.map((t) => ({ id: t.id, name: t.name, price: t.price, shortCode: t.shortCode }));
  const currency = settings?.currency ?? "NPR";

  return (
    <>
      <PageHeader title="Test Groups / Profiles" description="Bundle tests into profiles like CBC, LFT, or full-body checkups." actions={canManage && <NewGroupButton departments={deptOpts} tests={testOpts} />} />
      <div className="mb-4"><SearchBar placeholder="Search profile name…" /></div>

      {rows.length === 0 ? (
        <EmptyState icon={Layers} title="No profiles" description={q ? "Try a different search." : "Create your first test profile."} />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Profile</TH>
                <TH>Code</TH>
                <TH>Tests</TH>
                <TH>Pricing</TH>
                <TH className="text-right">Price</TH>
                <TH>Status</TH>
                {canManage && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {rows.map((g) => (
                <TR key={g.id}>
                  <TD className="font-medium">{g.name}</TD>
                  <TD>{g.shortCode ? <Badge tone="neutral">{g.shortCode}</Badge> : "—"}</TD>
                  <TD><Badge tone="info">{g.memberCount} tests</Badge></TD>
                  <TD className="capitalize text-muted-foreground">{g.pricingMode === "sum" ? "Sum of tests" : "Fixed"}</TD>
                  <TD className="text-right tabular">{g.pricingMode === "fixed" ? `${currency} ${money(g.groupPrice)}` : "—"}</TD>
                  <TD>{g.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</TD>
                  {canManage && (
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        <ToggleGroupButton groupId={g.id} active={g.isActive} />
                        <EditGroupButton groupId={g.id} departments={deptOpts} tests={testOpts} />
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
