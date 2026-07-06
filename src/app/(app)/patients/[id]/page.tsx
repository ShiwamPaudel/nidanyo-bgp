import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Phone, MapPin, Mail, UserRound, FileText } from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getPatientProfile } from "@/lib/queries/patients";
import { getLab } from "@/lib/queries/lab";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { ageLabel, formatMoney, money, initials } from "@/lib/utils";
import { fmtDate, fmtDateTime } from "@/lib/datetime";

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(PERMISSIONS.PATIENT_VIEW);
  const { id } = await params;
  const profile = await getPatientProfile(user.labId, id);
  if (!profile) notFound();
  const { lab, settings } = await getLab(user.labId);
  const currency = settings?.currency ?? "NPR";
  const { patient, visits, payments, totals } = profile;

  const canManage = hasPermission(user, PERMISSIONS.PATIENT_MANAGE);
  const canVisit = hasPermission(user, PERMISSIONS.VISIT_CREATE);

  return (
    <>
      <PageHeader
        title={patient.fullName}
        description={`Patient ID ${patient.code} · Registered ${fmtDate(patient.createdAt)}`}
        actions={
          <>
            {canManage && (
              <Link href={`/patients/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
                <Pencil className="size-4" /> Edit
              </Link>
            )}
            {canVisit && (
              <Link href={`/visits/new?patient=${id}`} className={buttonVariants()}>
                <Plus className="size-4" /> New visit
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: details + totals */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-brand-700 text-lg font-semibold text-white">
                  {initials(patient.fullName)}
                </span>
                <div>
                  <p className="font-semibold">{patient.fullName}</p>
                  <p className="text-sm capitalize text-muted-foreground">
                    {patient.gender} · {ageLabel(patient.ageValue, patient.ageUnit)}
                  </p>
                </div>
              </div>
              <dl className="mt-4 space-y-2.5 text-sm">
                <Detail icon={Phone} label="Phone" value={patient.phone} />
                <Detail icon={Mail} label="Email" value={patient.email} />
                <Detail icon={MapPin} label="Address" value={patient.address} />
                <Detail icon={UserRound} label="Referred by" value={patient.referredBy} />
                {patient.dob && <Detail icon={UserRound} label="Date of birth" value={fmtDate(patient.dob)} />}
              </dl>
              {patient.notes && (
                <p className="mt-4 rounded-lg bg-surface p-3 text-sm text-muted-foreground">{patient.notes}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Account summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <Row label="Total billed" value={formatMoney(totals.billed, currency)} />
              <Row label="Total paid" value={formatMoney(totals.paid, currency)} />
              <Row
                label="Outstanding due"
                value={formatMoney(totals.due, currency)}
                emphasize={totals.due > 0 ? "danger" : undefined}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: visits + payments */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Visit history</CardTitle>
              <Badge tone="neutral">{visits.length} visit{visits.length === 1 ? "" : "s"}</Badge>
            </CardHeader>
            <CardContent>
              {visits.length === 0 ? (
                <EmptyState
                  title="No visits yet"
                  description="Create a visit to order tests and generate a bill."
                  action={
                    canVisit ? (
                      <Link href={`/visits/new?patient=${id}`} className={buttonVariants({ size: "sm" })}>
                        <Plus className="size-4" /> New visit
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Visit</TH>
                        <TH>Date</TH>
                        <TH>Status</TH>
                        <TH>Payment</TH>
                        <TH className="text-right">Total</TH>
                        <TH className="text-right">Due</TH>
                        <TH></TH>
                      </TR>
                    </THead>
                    <TBody>
                      {visits.map((v) => (
                        <TR key={v.id}>
                          <TD className="font-medium">{v.code}</TD>
                          <TD className="text-muted-foreground">{fmtDate(v.visitDate)}</TD>
                          <TD>
                            <StatusChip status={v.billStatus === "cancelled" ? "cancelled" : v.status} />
                          </TD>
                          <TD>{v.paymentStatus ? <StatusChip status={v.paymentStatus} /> : "—"}</TD>
                          <TD className="text-right tabular">{money(v.grandTotal ?? 0)}</TD>
                          <TD className="text-right tabular">
                            {(v.dueAmount ?? 0) > 0 ? (
                              <span className="font-medium text-destructive">{money(v.dueAmount ?? 0)}</span>
                            ) : (
                              <span className="text-muted-foreground">0.00</span>
                            )}
                          </TD>
                          <TD className="text-right">
                            <Link href={`/visits/${v.id}`} className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Open visit">
                              <FileText className="size-4" />
                            </Link>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              )}
            </CardContent>
          </Card>

          {payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Payment history</CardTitle>
              </CardHeader>
              <CardContent>
                <TableWrap>
                  <Table>
                    <THead>
                      <TR>
                        <TH>Receipt</TH>
                        <TH>Date</TH>
                        <TH>Mode</TH>
                        <TH>Type</TH>
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
                          <TD className="text-right tabular font-medium">{money(p.amount)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableWrap>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Detail({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate">{value || "—"}</dd>
      </div>
    </div>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={emphasize === "danger" ? "font-semibold text-destructive tabular" : "font-medium tabular"}>{value}</span>
    </div>
  );
}
