"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Printer, ListChecks } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import { getVisitReportTests } from "@/lib/actions/report-actions";
import type { ReportTestOption } from "@/lib/queries/report";

/** Only approved tests can appear on a printed report. */
const isPrintable = (status: string) => status === "approved" || status === "dispatched";

/**
 * One selectable line: either a standalone test or a whole profile (CBC, Lipid
 * Profile…). A profile is offered as a single item — its member tests are not
 * listed individually, because a panel is printed and handed over as a unit.
 */
interface PickerItem {
  key: string;
  label: string;
  /** Shown only when every member test shares it. */
  department: string | null;
  isGroup: boolean;
  entryIds: string[];
  printableIds: string[];
  statuses: string[];
}

/** Roll a visit's tests up into standalone tests + one item per profile. */
function buildItems(tests: ReportTestOption[]): PickerItem[] {
  const items: PickerItem[] = [];
  const byGroup = new Map<string, PickerItem>();

  for (const t of tests) {
    const groupName = t.groupName?.trim() || "";
    const groupKey = t.groupId ?? (groupName ? `name:${groupName}` : null);

    if (!groupKey) {
      items.push({
        key: t.entryId,
        label: t.testName,
        department: t.department,
        isGroup: false,
        entryIds: [t.entryId],
        printableIds: isPrintable(t.status) ? [t.entryId] : [],
        statuses: [t.status],
      });
      continue;
    }

    let item = byGroup.get(groupKey);
    if (!item) {
      item = {
        key: `group:${groupKey}`,
        label: groupName || t.testName,
        department: t.department,
        isGroup: true,
        entryIds: [],
        printableIds: [],
        statuses: [],
      };
      byGroup.set(groupKey, item);
      items.push(item);
    } else if (item.department !== t.department) {
      item.department = null; // members span departments — don't claim one
    }

    item.entryIds.push(t.entryId);
    if (isPrintable(t.status)) item.printableIds.push(t.entryId);
    item.statuses.push(t.status);
  }

  return items;
}

/**
 * Lets staff pick what of a visit to print — so a completed test or profile can
 * be handed to the patient while the rest are still in progress. Tests that
 * aren't approved yet are listed (with their status) but not selectable.
 */
export function ReportTestPicker({ visitId, visitCode }: { visitId: string; visitCode: string }) {
  const [open, setOpen] = useState(false);
  const [loading, start] = useTransition();
  const [tests, setTests] = useState<ReportTestOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = useMemo(() => buildItems(tests), [tests]);

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

  /** Toggling a profile turns all of its printable tests on or off together. */
  function toggle(item: PickerItem) {
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = item.printableIds.length > 0 && item.printableIds.every((id) => next.has(id));
      for (const id of item.printableIds) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
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
        description="Pick the approved tests to include — a profile is selected as a whole. Draft / pending tests can't be printed until approved."
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
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No tests found for this visit.</p>
        ) : (
          <div className="space-y-1">
            {printableCount === 0 && (
              <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                None of these tests are approved yet, so there is nothing to print.
              </p>
            )}
            {items.map((item) => {
              const printable = item.printableIds.length > 0;
              const checked = printable && item.printableIds.every((id) => selected.has(id));
              const meta = [item.department, item.isGroup ? `${item.entryIds.length} tests` : null].filter(Boolean).join(" · ");
              return (
                <label
                  key={item.key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm",
                    printable ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    disabled={!printable}
                    checked={checked}
                    onChange={() => toggle(item)}
                    className="size-4 accent-brand-700"
                  />
                  <span className="flex-1">
                    <span className="font-medium">{item.label}</span>
                    {meta && <span className="block text-xs text-muted-foreground">{meta}</span>}
                  </span>
                  <ItemStatus item={item} />
                </label>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}

/** A profile with mixed member statuses can't use a single workflow chip. */
function ItemStatus({ item }: { item: PickerItem }) {
  const distinct = [...new Set(item.statuses)];
  if (distinct.length === 1) return <StatusChip status={distinct[0]} />;
  if (item.printableIds.length > 0) {
    return <Badge tone="warning">{item.printableIds.length} of {item.entryIds.length} approved</Badge>;
  }
  return <Badge tone="neutral">In progress</Badge>;
}
