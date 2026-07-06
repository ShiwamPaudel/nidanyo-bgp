"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import { computeFlag, flagSymbol, type ResultFlag } from "@/lib/result-flags";
import { saveResults, type ResultEntryInput } from "@/lib/actions/result-actions";

export interface RowDef {
  parameterId: string | null;
  label: string;
  unit: string | null;
  refText: string;
  refLow: number | null;
  refHigh: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  resultType: "numeric" | "text" | "select" | "pos_neg";
  options: string[] | null;
  value: string;
}
export interface EntryDef {
  entryId: string;
  testName: string;
  status: string;
  locked: boolean;
  correctionNote: string | null;
  technicianRemarks: string;
  rows: RowDef[];
}

export function ResultEntryForm({ visitId, initialEntries }: { visitId: string; initialEntries: EntryDef[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [entries, setEntries] = useState<EntryDef[]>(initialEntries);

  function setValue(ei: number, ri: number, value: string) {
    setEntries((prev) => {
      const next = structuredClone(prev);
      next[ei].rows[ri].value = value;
      return next;
    });
  }
  function setRemarks(ei: number, value: string) {
    setEntries((prev) => {
      const next = structuredClone(prev);
      next[ei].technicianRemarks = value;
      return next;
    });
  }

  function payload(): { visitId: string; entries: ResultEntryInput[] } {
    return {
      visitId,
      entries: entries
        .filter((e) => !e.locked)
        .map((e) => ({
          entryId: e.entryId,
          technicianRemarks: e.technicianRemarks || null,
          values: e.rows.map((r) => ({ parameterId: r.parameterId, label: r.label, value: r.value })),
        })),
    };
  }

  function save(mode: "draft" | "submit") {
    if (mode === "submit") {
      const empty = entries.some((e) => !e.locked && e.rows.every((r) => !r.value.trim()));
      if (empty) return toast.error("Enter at least one value for each test before submitting");
    }
    start(async () => {
      const res = await saveResults({ ...payload(), mode });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        if (mode === "submit") {
          router.push("/results");
        }
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, ei) => (
        <Card key={entry.entryId}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {entry.testName}
              <StatusChip status={entry.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {entry.correctionNote && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span><span className="font-medium">Correction requested:</span> {entry.correctionNote}</span>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 font-semibold">Parameter</th>
                    <th className="py-2 font-semibold">Result</th>
                    <th className="py-2 font-semibold">Unit</th>
                    <th className="py-2 font-semibold">Reference</th>
                    <th className="py-2 font-semibold">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.rows.map((row, ri) => {
                    const num = row.value.trim() === "" ? null : Number(row.value);
                    const flag: ResultFlag =
                      num != null && !Number.isNaN(num)
                        ? computeFlag(num, { refLow: row.refLow, refHigh: row.refHigh, criticalLow: row.criticalLow, criticalHigh: row.criticalHigh })
                        : "normal";
                    const critical = flag === "critical_low" || flag === "critical_high";
                    return (
                      <tr key={ri} className="border-b border-border/60">
                        <td className="py-2 pr-3 font-medium">{row.label}</td>
                        <td className="py-2 pr-3">
                          {row.resultType === "select" && row.options ? (
                            <Select value={row.value} onChange={(e) => setValue(ei, ri, e.target.value)} disabled={entry.locked} className="h-9 w-36">
                              <option value="">—</option>
                              {row.options.map((o) => <option key={o} value={o}>{o}</option>)}
                            </Select>
                          ) : row.resultType === "pos_neg" ? (
                            <Select value={row.value} onChange={(e) => setValue(ei, ri, e.target.value)} disabled={entry.locked} className="h-9 w-36">
                              <option value="">—</option>
                              <option value="Negative">Negative</option>
                              <option value="Positive">Positive</option>
                            </Select>
                          ) : (
                            <Input
                              value={row.value}
                              onChange={(e) => setValue(ei, ri, e.target.value)}
                              disabled={entry.locked}
                              inputMode={row.resultType === "numeric" ? "decimal" : "text"}
                              className={cn("h-9 w-36", critical && "border-destructive text-destructive font-semibold", flag !== "normal" && !critical && "border-amber-400")}
                              placeholder="Enter"
                            />
                          )}
                        </td>
                        <td className="py-2 pr-3 text-muted-foreground">{row.unit ?? "—"}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{row.refText}</td>
                        <td className="py-2">
                          {flag !== "normal" && (
                            <Badge tone={critical ? "danger" : "warning"}>
                              {critical && <AlertTriangle className="size-3" />} {flagSymbol(flag)}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Textarea
              value={entry.technicianRemarks}
              onChange={(e) => setRemarks(ei, e.target.value)}
              placeholder="Technician remarks (optional)"
              disabled={entry.locked}
              className="min-h-[52px] text-sm"
            />
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 flex items-center justify-end gap-2 rounded-xl border border-border bg-card/90 p-3 shadow-lift backdrop-blur">
        <Button variant="outline" onClick={() => save("draft")} loading={pending}>
          <Save className="size-4" /> Save draft
        </Button>
        <Button onClick={() => save("submit")} loading={pending}>
          <Send className="size-4" /> Submit for approval
        </Button>
      </div>
    </div>
  );
}
