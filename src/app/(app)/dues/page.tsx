import Link from "next/link";
import { Wallet, ExternalLink, CheckCircle2 } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listDues } from "@/lib/queries/dues";
import { getPaymentModes } from "@/lib/queries/catalog";
import { getLab } from "@/lib/queries/lab";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { Pagination } from "@/components/ui/pagination";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { StatusChip } from "@/components/ui/status-chip";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { money, formatMoney } from "@/lib/utils";
import { fmtDate } from "@/lib/datetime";
import { ReceivePaymentButton } from "../visits/[id]/visit-actions";

export const metadata = { title: "Due Collection" };

export default async function DuesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.DUE_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = typeof sp.page === "string" ? Number(sp.page) : 1;
  const { rows, total, totalDue, pageSize } = await listDues(user.labId, { q, page });
  const { settings } = await getLab(user.labId);
  const currency = settings?.currency ?? "NPR";
  const modes = (await getPaymentModes(user.labId)).map((m) => ({ id: m.id, name: m.name }));
  const canCollect = hasPermission(user, PERMISSIONS.DUE_COLLECT);

  return (
    <>
      <PageHeader title="Due Collection" description="Outstanding bills awaiting payment. Collect dues and print receipts." />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Total outstanding</p>
            <p className="text-2xl font-bold text-destructive tabular">{formatMoney(totalDue, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Bills with due</p>
            <p className="text-2xl font-bold tabular">{total}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4">
        <SearchBar placeholder="Search by patient, phone, bill or visit no…" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={q ? Wallet : CheckCircle2} title={q ? "No matching dues" : "No outstanding dues"} description={q ? "Try a different search." : "All bills are fully paid."} />
      ) : (
        <>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Bill</TH>
                  <TH>Patient</TH>
                  <TH>Date</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Total</TH>
                  <TH className="text-right">Paid</TH>
                  <TH className="text-right">Due</TH>
                  <TH className="text-right">Action</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((d) => (
                  <TR key={d.billId}>
                    <TD>
                      <Link href={`/visits/${d.visitId}`} className="font-medium hover:text-brand-700 hover:underline">{d.billCode}</Link>
                      <span className="block text-xs text-muted-foreground">{d.visitCode}</span>
                    </TD>
                    <TD>
                      <span className="font-medium">{d.patientName}</span>
                      <span className="block text-xs text-muted-foreground">{d.patientCode} · {d.patientPhone ?? "—"}</span>
                    </TD>
                    <TD className="text-muted-foreground">{fmtDate(d.createdAt)}</TD>
                    <TD><StatusChip status={d.paymentStatus} /></TD>
                    <TD className="text-right tabular">{money(d.grandTotal)}</TD>
                    <TD className="text-right tabular">{money(d.paidAmount)}</TD>
                    <TD className="text-right tabular font-semibold text-destructive">{money(d.dueAmount)}</TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canCollect && <ReceivePaymentButton billId={d.billId} due={d.dueAmount} modes={modes} label="Collect" />}
                        <Link href={`/visits/${d.visitId}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Open"><ExternalLink className="size-4" /></Link>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
          <Pagination page={page} pageSize={pageSize} total={total} searchParams={sp} basePath="/dues" />
        </>
      )}
    </>
  );
}
