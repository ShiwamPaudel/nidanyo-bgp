"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Printer, ListChecks } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import { getVisitReportTests } from "@/lib/actions/report-actions";
import type { ReportTestOption } from "@/lib/queries/report";

/** Only approved tests can appear on a printed report. */
const isPrintable = (status: string) => status === "approved" || status === "dispatched";

/**
 * Lets staff pick which of a visit's tests to print — so a completed test or two
 * can be handed to the patient while the rest are still in progress. Draft /
 * pending tests are listed (with their status) but not selectable.
 */
export function ReportTestPicker({ visitId, visitCode }: { visitId: string; visitCode: string }) {
  const [open, setOpen] = useState(false);
  const [loading, start] = useTransition();
  const [tests, setTests] = useState<ReportTestOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function openPicker() {
    setOpen(true);
    start(async () => {
      const res = await getVisitReportTests(visitId);
      if (res.ok) {
        setTests(res.data);
        // Pre-select every printable (approved) test.
        setSelected(new Set(res.data.filter((t) => isPrintable(t.status)).map((t) => t.entryId)));
      } else {
        toast.error(res.error);
        setOpen(false);
      }
    });
  }

  function toggle(entryId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(entryId) ? next.delete(entryId) : next.add(entryId);
      return next;
    });
  }

  function printSelected() {
    if (selected.size === 0) return toast.error("Select at least one test to print.");
    const qs = new URLSearchParams({ entries: [...selected].join(",") }).toString();
    window.open(`/print/report/${visitId}?${qs}`, "_blank", "noopener");
    setOpen(false);
  }

  const printableCount = tests.filter((t) => isPrintable(t.status)).length;

  return (
    <>
      <button
        onClick={openPicker}
        className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        aria-label="Select tests to print"
        title="Select tests to print"
      >
        <ListChecks className="size-4" />
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Print selected tests · ${visitCode}`}
        description="Pick the approved tests to include. Draft / pending tests can't be printed until approved."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={printSelected} disabled={loading || selected.size === 0}>
              <Printer className="size-4" /> Print selected ({selected.size})
            </Button>
          </>
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading tests…</p>
        ) : tests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No tests found for this visit.</p>
        ) : (
          <div className="space-y-1">
            {printableCount === 0 && (
              <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                None of these tests are approved yet, so there is nothing to print.
              </p>
            )}
            {tests.map((t) => {
              const printable = isPrintable(t.status);
              return (
                <label
                  key={t.entryId}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm",
                    printable ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={!printable}
                    checked={selected.has(t.entryId)}
                    onChange={() => toggle(t.entryId)}
                    className="size-4 accent-brand-700"
                  />
                  <span className="flex-1">
                    <span className="font-medium">{t.testName}</span>
                    {t.department && <span className="block text-xs text-muted-foreground">{t.department}</span>}
                  </span>
                  <StatusChip status={t.status} />
                </label>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
