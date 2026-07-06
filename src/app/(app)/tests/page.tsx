import { Beaker } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listTestsAdmin } from "@/lib/queries/catalog-admin";
import { getDepartments, getSampleTypes } from "@/lib/queries/catalog";
import { getLab } from "@/lib/queries/lab";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { money } from "@/lib/utils";
import { NewTestButton, EditTestButton, ToggleTestButton } from "./test-manager";

export const metadata = { title: "Tests" };

export default async function TestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.CATALOG_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const [rows, departments, sampleTypes, { settings }] = await Promise.all([
    listTestsAdmin(user.labId, q),
    getDepartments(user.labId),
    getSampleTypes(user.labId),
    getLab(user.labId),
  ]);
  const canManage = hasPermission(user, PERMISSIONS.CATALOG_MANAGE);
  const deptOpts = departments.map((d) => ({ id: d.id, name: d.name }));
  const sampleOpts = sampleTypes.map((s) => ({ id: s.id, name: s.name }));
  const currency = settings?.currency ?? "NPR";

  return (
    <>
      <PageHeader title="Tests" description="Manage your test catalog, pricing, reference ranges, and parameters." actions={canManage && <NewTestButton departments={deptOpts} sampleTypes={sampleOpts} />} />
      <div className="mb-4"><SearchBar placeholder="Search test name or code…" /></div>

      {rows.length === 0 ? (
        <EmptyState icon={Beaker} title="No tests" description={q ? "Try a different search." : "Add your first test to start billing."} />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Test</TH>
                <TH>Code</TH>
                <TH>Department</TH>
                <TH>Sample</TH>
                <TH>Type</TH>
                <TH className="text-right">Price</TH>
                <TH>Status</TH>
                {canManage && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {rows.map((t) => (
                <TR key={t.id}>
                  <TD className="font-medium">{t.name}</TD>
                  <TD><Badge tone="neutral">{t.shortCode}</Badge></TD>
                  <TD className="text-muted-foreground">{t.deptName ?? "—"}</TD>
                  <TD className="text-muted-foreground">{t.sampleName ?? "—"}</TD>
                  <TD>{t.paramCount > 0 ? <Badge tone="info">{t.paramCount} params</Badge> : <span className="text-xs capitalize text-muted-foreground">{t.resultType}</span>}</TD>
                  <TD className="text-right tabular">{currency} {money(t.price)}</TD>
                  <TD>{t.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</TD>
                  {canManage && (
                    <TD>
                      <div className="flex items-center justify-end gap-1">
                        <ToggleTestButton testId={t.id} active={t.isActive} />
                        <EditTestButton testId={t.id} departments={deptOpts} sampleTypes={sampleOpts} />
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
