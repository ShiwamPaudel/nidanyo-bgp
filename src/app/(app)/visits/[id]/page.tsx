import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer, UserRound, Link2, CheckCircle2, Clock } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getVisitDetail } from "@/lib/queries/billing";
import { getPaymentModes } from "@/lib/queries/catalog";
import { getLab } from "@/lib/queries/lab";
import { reportUrl } from "@/lib/report-engine";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { money, ageLabel } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "@/lib/datetime";
import { ReceivePaymentButton, CancelVisitButton } from "./visit-actions";

export default async function VisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.VISIT_VIEW);
  const { id } = await params;
  const detail = await getVisitDetail(user.labId, id);
  if (!detail) notFound();
  const { visit, patient, bill, items, visitTests, payments, samples, reportLink } = detail;
  const { settings } = await getLab(user.labId);
  const currency = settings?.currency ?? "NPR";
  const modes = await getPaymentModes(user.labId);

  const cancelled = visit.status === "cancelled";
  const canPay = hasPermission(user, PERMISSIONS.PAYMENT_RECEIVE) && !cancelled && bill && bill.dueAmount > 0;
  const canCancel = hasPermission(user, PERMISSIONS.VISIT_CANCEL) && !cancelled;
  const publicUrl = reportLink ? await reportUrl(reportLink.token, user.labId) : null;

  return (
    <>
      <PageHeader
        title={`Visit ${visit.code}`}
        description={`${patient?.fullName} · ${patient?.code} · ${fmtDateTime(visit.visitDate)}`}
        actions={
          <>
            {bill && (
              <Link href={`/print/bill/${id}`} className={buttonVariants({ variant: "outline" })} target="_blank">
                <Printer className="size-4" /> Print bill
              </Link>
            )}
            {canPay && <ReceivePaymentButton billId={bill!.id} due={bill!.dueAmount} modes={modes.map((m) => ({ id: m.id, name: m.name }))} />}
            {canCancel && <CancelVisitButton visitId={visit.id} visitCode={visit.code} />}
          </>
        }
      />

      {cancelled && (
        <div className="mb-4 rounded-xl border border-red-200 bg-danger-50 px-4 py-3 text-sm text-destructive">
          This visit was cancelled. Reason: <span className="font-medium">{visit.cancelledReason}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Status row */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip status={cancelled ? "cancelled" : visit.status} />
            {bill && <StatusChip status={bill.paymentStatus} />}
            {visit.priority === "urgent" && <Badge tone="danger">Urgent</Badge>}
          </div>

          {/* Tests */}
          <Card>
            <CardHeader>
              <CardTitle>Ordered tests</CardTitle>
            </CardHeader>
            <CardContent>
              <TableWrap>
                <Table>
                  <THead>
                    <TR>
                      <TH>Test</TH>
                      <TH>Profile</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Price</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {visitTests.map((t) => (
                      <TR key={t.id}>
                        <TD className="font-medium">{t.testName}</TD>
                        <TD className="text-muted-foreground">{t.groupName ?? "—"}</TD>
                        <TD><StatusChip status={t.status} /></TD>
                        <TD className="text-right tabular">{money(t.price)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            </CardContent>
          </Card>

          {/* Payments */}
          {bill && (
            <Card>
              <CardHeader>
                <CardTitle>Payment history</CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <TableWrap>
                    <Table>
                      <THead>
                        <TR>
                          <TH>Receipt</TH>
                          <TH>Date</TH>
                          <TH>Mode</TH>
                          <TH>Type</TH>
                          <TH>Received by</TH>
                          <TH className="text-right">Amount</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {payments.map((p) => (
                          <TR key={p.id}>
                            <TD className="font-medium">{p.code}</TD>
                            <TD className="text-muted-foreground">{fmtDateTime(p.paidAt)}</TD>
                            <TD>{p.mode}</TD>
                            <TD className="capitalize text-muted-foreground">{p.kind.replace("_", " ")}</TD>
                            <TD className="text-muted-foreground">{p.receivedByName ?? "—"}</TD>
                            <TD className="text-right tabular font-medium">{money(p.amount)}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </TableWrap>
                )}
              </CardContent>
            </Card>
          )}

          {/* Samples */}
          {samples.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Samples</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {samples.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                      <p className="font-medium">{s.code}</p>
                      <p className="text-xs text-muted-foreground">{s.sampleTypeName}</p>
                      <StatusChip status={s.status} className="mt-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: bill + patient + report */}
        <div className="space-y-4">
          <Card>
            <CardContent className="flex items-center gap-3 pt-5">
              <span className="flex size-10 items-center justify-center rounded-full bg-brand-700 text-white"><UserRound className="size-5" /></span>
              <div>
                <Link href={`/patients/${patient?.id}`} className="font-semibold hover:text-brand-700 hover:underline">{patient?.fullName}</Link>
                <p className="text-sm capitalize text-muted-foreground">{patient?.gender} · {ageLabel(patient?.ageValue, patient?.ageUnit)} · {patient?.phone ?? "—"}</p>
              </div>
            </CardContent>
          </Card>

          {bill && (
            <Card>
              <CardHeader><CardTitle>Bill {bill.code}</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label="Subtotal" value={money(bill.subtotal)} />
                {bill.discountAmount > 0 && <Row label="Discount" value={`- ${money(bill.discountAmount)}`} />}
                {bill.taxAmount > 0 && <Row label={`Tax (${bill.taxPercent}%)`} value={money(bill.taxAmount)} />}
                <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Grand total</span><span className="tabular">{currency} {money(bill.grandTotal)}</span>
                </div>
                <Row label="Paid" value={money(bill.paidAmount)} />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Due</span>
                  <span className={bill.dueAmount > 0 ? "font-semibold text-destructive tabular" : "font-medium text-brand-700 tabular"}>{money(bill.dueAmount)}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Report link status */}
          <Card>
            <CardHeader><CardTitle>Report</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {reportLink?.isActive ? (
                <>
                  <div className="flex items-center gap-2 text-sm text-brand-700">
                    <CheckCircle2 className="size-4" /> <span className="font-medium">Report is ready & shared</span>
                  </div>
                  {publicUrl && (
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 break-all text-xs text-info hover:underline">
                      <Link2 className="size-3.5 shrink-0" /> {publicUrl}
                    </a>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  <span>Report becomes available after approval and full payment.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
