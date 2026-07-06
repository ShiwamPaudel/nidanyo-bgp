import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getVisitResults } from "@/lib/queries/results";
import { PageHeader } from "@/components/ui/page";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { ageLabel } from "@/lib/utils";
import { refRangeText } from "@/lib/result-flags";
import { ResultEntryForm, type EntryDef, type RowDef } from "./result-entry-form";

export const metadata = { title: "Enter results" };

export default async function ResultEntryPage({ params }: { params: Promise<{ visitId: string }> }) {
  const user = await requirePermission(PERMISSIONS.RESULT_ENTER);
  const { visitId } = await params;
  const data = await getVisitResults(user.labId, visitId);
  if (!data) notFound();
  const { visit, patient, entries } = data;

  const formEntries: EntryDef[] = entries.map(({ entry, test, params: paramRows, values, sample }) => {
    const locked = entry.status === "approved" || entry.status === "dispatched";
    const valueByKey = new Map(values.map((v) => [v.parameterId ?? "single", v.valueText ?? ""]));

    let rows: RowDef[];
    if (paramRows.length > 0) {
      rows = paramRows.map((p) => ({
        parameterId: p.id,
        label: p.name,
        unit: p.unit ?? null,
        refText: refRangeText({ refLow: p.refLow, refHigh: p.refHigh, refRangeText: p.refRangeText }),
        refLow: p.refLow ?? null,
        refHigh: p.refHigh ?? null,
        criticalLow: p.criticalLow ?? null,
        criticalHigh: p.criticalHigh ?? null,
        resultType: (p.resultType as RowDef["resultType"]) ?? "numeric",
        options: (p.selectOptions as string[] | null) ?? null,
        value: valueByKey.get(p.id) ?? "",
      }));
    } else {
      rows = [
        {
          parameterId: null,
          label: test?.name ?? entry.testName,
          unit: test?.unit ?? null,
          refText: refRangeText({ refLow: test?.refLow, refHigh: test?.refHigh, refRangeText: test?.refRangeText }),
          refLow: test?.refLow ?? null,
          refHigh: test?.refHigh ?? null,
          criticalLow: test?.criticalLow ?? null,
          criticalHigh: test?.criticalHigh ?? null,
          resultType: (test?.resultType as RowDef["resultType"]) ?? "numeric",
          options: (test?.selectOptions as string[] | null) ?? null,
          value: valueByKey.get("single") ?? "",
        },
      ];
    }

    return {
      entryId: entry.id,
      testName: entry.testName,
      status: entry.status,
      locked,
      correctionNote: entry.correctionNote ?? null,
      technicianRemarks: entry.technicianRemarks ?? "",
      rows,
    };
  });

  const sampleNotCollected = entries.every((e) => e.sample && e.sample.status === "waiting");

  return (
    <>
      <PageHeader
        title={`Results · ${visit.code}`}
        description={`${patient?.fullName} · ${patient?.code} · ${patient?.gender}, ${ageLabel(patient?.ageValue, patient?.ageUnit)}`}
        actions={
          <Link href="/results" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="size-4" /> Back to queue
          </Link>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex items-center gap-3 pt-5">
          <span className="flex size-10 items-center justify-center rounded-full bg-brand-700 text-white"><UserRound className="size-5" /></span>
          <div>
            <p className="font-semibold">{patient?.fullName}</p>
            <p className="text-sm capitalize text-muted-foreground">{patient?.code} · {patient?.gender} · {ageLabel(patient?.ageValue, patient?.ageUnit)} · {patient?.phone ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      {formEntries.length === 0 ? (
        <EmptyState title="No tests to report" description="This visit has no result entries." />
      ) : sampleNotCollected ? (
        <EmptyState title="Samples not collected yet" description="Collect the samples before entering results." />
      ) : (
        <ResultEntryForm visitId={visitId} initialEntries={formEntries} />
      )}
    </>
  );
}
