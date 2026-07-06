import Link from "next/link";
import { UserPlus, Users, Eye } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listPatients } from "@/lib/queries/patients";
import { PageHeader } from "@/components/ui/page";
import { buttonVariants } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";
import { Pagination } from "@/components/ui/pagination";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { ageLabel } from "@/lib/utils";
import { fmtDate } from "@/lib/datetime";

export const metadata = { title: "Patients" };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission(PERMISSIONS.PATIENT_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;
  const { rows, total, pageSize } = await listPatients(user.labId, { q, page });
  const canManage = hasPermission(user, PERMISSIONS.PATIENT_MANAGE);

  return (
    <>
      <PageHeader
        title="Patients"
        description="Search the patient directory or register someone new."
        actions={
          canManage && (
            <Link href="/patients/new" className={buttonVariants()}>
              <UserPlus className="size-4" /> Register patient
            </Link>
          )
        }
      />

      <div className="mb-4">
        <SearchBar placeholder="Search by name, phone or patient ID…" />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "No patients found" : "No patients yet"}
          description={q ? "Try a different name or phone number." : "Register your first patient to get started."}
          action={
            canManage && !q ? (
              <Link href="/patients/new" className={buttonVariants({ size: "sm" })}>
                <UserPlus className="size-4" /> Register patient
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Patient ID</TH>
                  <TH>Name</TH>
                  <TH>Gender / Age</TH>
                  <TH>Phone</TH>
                  <TH>Referred by</TH>
                  <TH>Visits</TH>
                  <TH>Registered</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((p) => (
                  <TR key={p.id}>
                    <TD>
                      <Badge tone="neutral">{p.code}</Badge>
                    </TD>
                    <TD className="font-medium">
                      <Link href={`/patients/${p.id}`} className="hover:text-brand-700 hover:underline">
                        {p.fullName}
                      </Link>
                    </TD>
                    <TD className="capitalize text-muted-foreground">
                      {p.gender} · {ageLabel(p.ageValue, p.ageUnit)}
                    </TD>
                    <TD className="text-muted-foreground tabular">{p.phone ?? "—"}</TD>
                    <TD className="text-muted-foreground">{p.referredBy ?? "—"}</TD>
                    <TD className="tabular">{p.visitCount}</TD>
                    <TD className="text-muted-foreground">{fmtDate(p.createdAt)}</TD>
                    <TD className="text-right">
                      <Link href={`/patients/${p.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="View">
                        <Eye className="size-4" />
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <Pagination page={page} pageSize={pageSize} total={total} searchParams={sp} basePath="/patients" />
        </>
      )}
    </>
  );
}
