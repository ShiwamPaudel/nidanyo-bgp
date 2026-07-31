import Link from "next/link";
import { TestTube, CheckCircle2 } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listSamples } from "@/lib/queries/samples";
import { PageHeader } from "@/components/ui/page";
import { SearchBar } from "@/components/ui/search-bar";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import { StatusChip } from "@/components/ui/status-chip";
import { Badge } from "@/components/ui/badge";
import { fmtRelative } from "@/lib/datetime";
import { SampleRowActions } from "./sample-actions";

export const metadata = { title: "Sample Collection" };

export default async function SampleCollectionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission(PERMISSIONS.SAMPLE_VIEW);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const status = typeof sp.status === "string" ? sp.status : "waiting";
  const rows = await listSamples(user.labId, { q, status });

  return (
    <>
      <PageHeader title="Sample Collection" description="Collect specimens, print labels, and manage rejections or recollections." />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBar placeholder="Search sample, visit, patient or phone…" />
        <FilterTabs
          param="status"
          options={[
            { value: "waiting", label: "Waiting" },
            { value: "collected", label: "Collected" },
            { value: "recollection", label: "Recollection" },
            { value: "all", label: "All" },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={status === "waiting" ? CheckCircle2 : TestTube} title={status === "waiting" ? "Nothing waiting" : "No samples"} description={status === "waiting" ? "All samples have been collected." : "No samples match this filter."} />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Sample</TH>
                <TH>Patient</TH>
                <TH>Specimen</TH>
                <TH>Tests</TH>
                <TH>Status</TH>
                <TH>When</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((s) => (
                <TR key={s.id}>
                  <TD>
                    <Badge tone="neutral">{s.code}</Badge>
                    <Link href={`/visits/${s.visitId}`} className="ml-2 text-xs text-info hover:underline">{s.visitCode}</Link>
                    {s.priority === "urgent" && <Badge tone="danger" className="ml-1">Urgent</Badge>}
                  </TD>
                  <TD>
                    <span className="font-medium">{s.patientName}</span>
                    <span className="block text-xs text-muted-foreground">{s.patientCode} · {s.patientPhone ?? "—"}</span>
                  </TD>
                  <TD>{s.sampleTypeName}</TD>
                  <TD>
                    {/* The collector needs to know what this tube is being drawn
                        for, not just how many tests there are. Profiles show as
                        the billed group (CBC) rather than their analytes; the
                        count underneath still reports individual tests. */}
                    <div className="max-w-[340px]">
                      {s.testNames ? (
                        <div className="flex flex-wrap gap-1">
                          {s.testNames.split(", ").map((name, i) => (
                            <span key={`${s.id}-${i}`} className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {s.testCount} test{s.testCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </TD>
                  <TD>
                    <StatusChip status={s.status} />
                    {s.rejectionReason && <span className="block text-xs text-destructive">{s.rejectionReason}</span>}
                  </TD>
                  <TD className="text-muted-foreground">{s.status === "collected" ? fmtRelative(s.collectedAt) : fmtRelative(s.createdAt)}</TD>
                  <TD><SampleRowActions sampleId={s.id} status={s.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </>
  );
}
