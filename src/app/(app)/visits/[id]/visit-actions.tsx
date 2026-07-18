"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, XCircle, RefreshCw, AlertTriangle, FlaskConical, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusChip } from "@/components/ui/status-chip";
import { money } from "@/lib/utils";
import { receivePayment, cancelVisit, addTestsToVisit } from "@/lib/actions/billing-actions";
import { previewReferenceRangeSync, syncReferenceRanges, type RangeSyncPreviewItem } from "@/lib/actions/result-actions";
import { reopenApprovedResults } from "@/lib/actions/approval-actions";
import { getVisitReportTests } from "@/lib/actions/report-actions";
import type { ReportTestOption } from "@/lib/queries/report";

type Mode = { id: string; name: string };

export function ReceivePaymentButton({
  billId,
  due,
  modes,
  label = "Receive payment",
}: {
  billId: string;
  due: number;
  modes: Mode[];
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState<number | "">("");
  const [discount, setDiscount] = useState<number | "">("");
  const [modeId, setModeId] = useState(modes[0]?.id ?? "");
  const [remarks, setRemarks] = useState("");

  const netDue = Math.max(0, due - (Number(discount) || 0));

  function submit() {
    const amt = Number(amount) || 0;
    const disc = Number(discount) || 0;
    if (amt <= 0 && disc <= 0) return toast.error("Enter a payment amount or a discount");
    start(async () => {
      const res = await receivePayment({ billId, amount: amt, discount: disc, modeId, remarks: remarks || null });
      if (res.ok) {
        toast.success(res.message ?? "Payment received");
        setOpen(false);
        setAmount("");
        setDiscount("");
        setRemarks("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Banknote className="size-4" /> {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Receive payment"
        description={`Outstanding due: ${money(due)}`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} loading={pending}>Receive</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <Input type="number" min={0} max={netDue} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.00" autoFocus />
            </Field>
            <Field label="Discount (optional)">
              <Input type="number" min={0} max={due} value={discount} onChange={(e) => setDiscount(e.target.value === "" ? "" : Number(e.target.value))} placeholder="0.00" />
            </Field>
          </div>
          <div className="flex items-center justify-between text-xs">
            <button type="button" onClick={() => setAmount(netDue)} className="font-medium text-info hover:underline">
              Pay remaining due ({money(netDue)})
            </button>
            {(Number(discount) || 0) > 0 && <span className="text-muted-foreground">Due after discount: {money(netDue)}</span>}
          </div>
          <Field label="Payment mode">
            <Select value={modeId} onChange={(e) => setModeId(e.target.value)}>
              {modes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="Remarks (optional)">
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} className="min-h-[56px]" placeholder="Reason for discount / any note" />
          </Field>
        </div>
      </Modal>
    </>
  );
}

export function CancelVisitButton({ visitId, visitCode }: { visitId: string; visitCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");

  function submit() {
    if (reason.trim().length < 3) return toast.error("Please provide a reason");
    start(async () => {
      const res = await cancelVisit({ visitId, reason });
      if (res.ok) {
        toast.success(res.message ?? "Visit cancelled");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="text-destructive hover:bg-danger-50">
        <XCircle className="size-4" /> Cancel visit
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Cancel visit ${visitCode}?`}
        description="This voids the visit and bill but keeps a permanent record. A reason is required."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Keep visit</Button>
            <Button variant="danger" onClick={submit} loading={pending}>Cancel visit</Button>
          </>
        }
      >
        <Field label="Reason for cancellation" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Patient declined tests" autoFocus />
        </Field>
      </Modal>
    </>
  );
}

/**
 * Fills in reference ranges that were missing when a result was entered, using
 * the current catalog. Always previews first: filling a range can flip a value
 * to H/L on a report that may already be with the patient, so the change is
 * shown before it is applied rather than after.
 */
export function SyncRangesButton({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, startLoad] = useTransition();
  const [applying, startApply] = useTransition();
  const [items, setItems] = useState<RangeSyncPreviewItem[] | null>(null);

  function openPreview() {
    setOpen(true);
    setItems(null);
    startLoad(async () => {
      const r = await previewReferenceRangeSync(visitId);
      if (r.ok) setItems(r.data.items);
      else { toast.error(r.error); setOpen(false); }
    });
  }

  function apply() {
    startApply(async () => {
      const r = await syncReferenceRanges(visitId);
      if (r.ok) { toast.success(r.message ?? "Synced"); setOpen(false); router.refresh(); }
      else toast.error(r.error);
    });
  }

  const flagChanges = items?.filter((i) => i.oldFlag !== i.newFlag).length ?? 0;

  return (
    <>
      <Button variant="outline" size="sm" onClick={openPreview}>
        <RefreshCw className="size-4" /> Sync reference ranges
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Sync reference ranges"
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={applying}>Cancel</Button>
            <Button onClick={apply} loading={applying} disabled={loading || !items || items.length === 0}>
              Apply to {items?.length ?? 0} value{items?.length === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        {loading && <p className="py-6 text-center text-sm text-muted-foreground">Checking results…</p>}

        {!loading && items && items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing to sync. Every result here either already has a reference range, or the test catalog still has no range to supply.
          </p>
        )}

        {!loading && items && items.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              These values were saved without a reference range. The range below comes from the test catalog as it stands now.
              Values that already have a range are never touched.
            </p>

            {flagChanges > 0 && (
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-semibold">{flagChanges} value{flagChanges === 1 ? "" : "s"} will change flag.</span>{" "}
                  If this report has already been issued to the patient, re-check it and re-issue after applying.
                </p>
              </div>
            )}

            <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-2 py-1.5">Test</th>
                    <th className="px-2 py-1.5">Parameter</th>
                    <th className="px-2 py-1.5">Value</th>
                    <th className="px-2 py-1.5">Reference to apply</th>
                    <th className="px-2 py-1.5">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={`${it.entryId}-${it.label}-${i}`} className="border-b border-border/60">
                      <td className="px-2 py-1.5">{it.testName}</td>
                      <td className="px-2 py-1.5">{it.label}</td>
                      <td className="px-2 py-1.5 tabular">{it.value ?? "—"}</td>
                      <td className="px-2 py-1.5 tabular">{it.newRef}</td>
                      <td className="px-2 py-1.5">
                        {it.oldFlag === it.newFlag ? (
                          <span className="text-muted-foreground">no change</span>
                        ) : (
                          <span className="font-medium text-amber-700">{it.oldFlag} → {it.newFlag}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/**
 * Admin-only: reopen already-approved results for correction. Lists the visit's
 * approved / dispatched tests, lets the admin pick which to send back to results
 * entry with a reason. See `reopenApprovedResults` for what it does server-side.
 */
export function ReopenResultsButton({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [tests, setTests] = useState<ReportTestOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");

  const reopenable = (s: string) => s === "approved" || s === "dispatched";

  function openModal() {
    setOpen(true);
    setReason("");
    startLoad(async () => {
      const res = await getVisitReportTests(visitId);
      if (res.ok) {
        const approved = res.data.filter((t) => reopenable(t.status));
        setTests(approved);
        setSelected(new Set(approved.map((t) => t.entryId)));
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

  function submit() {
    if (selected.size === 0) return toast.error("Select at least one test to reopen.");
    if (reason.trim().length < 3) return toast.error("Please provide a reason.");
    startSave(async () => {
      const res = await reopenApprovedResults({ visitId, entryIds: [...selected], reason });
      if (res.ok) {
        toast.success(res.message ?? "Reopened");
        setOpen(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button variant="outline" className="text-destructive hover:bg-danger-50" onClick={openModal}>
        <Undo2 className="size-4" /> Reopen results
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reopen approved results"
        description="Admin only. Sends the selected approved tests back to results entry for correction and deactivates the report until they are re-approved."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button variant="danger" onClick={submit} loading={saving} disabled={loading || selected.size === 0}>
              Reopen {selected.size} test{selected.size === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading approved tests…</p>
        ) : tests.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No approved tests to reopen.</p>
        ) : (
          <div className="space-y-3">
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {tests.map((t) => (
                <label key={t.entryId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                  <input type="checkbox" checked={selected.has(t.entryId)} onChange={() => toggle(t.entryId)} className="size-4 accent-brand-700" />
                  <span className="flex-1">
                    <span className="font-medium">{t.testName}</span>
                    {t.department && <span className="block text-xs text-muted-foreground">{t.department}</span>}
                  </span>
                  <StatusChip status={t.status} />
                </label>
              ))}
            </div>
            <Field label="Reason for reopening" required>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong unit entered for creatinine — please correct" autoFocus />
            </Field>
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>The report link is deactivated until these tests are corrected and re-approved.</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/**
 * Pull a visit back in line with its test groups.
 *
 * A visit records what was ordered at the time, so editing a group afterwards
 * never reaches back into it — by design, since a group edit must not silently
 * rewrite past records. That leaves a visit created before the group gained
 * members with no way to catch up. This is that way: it syncs ONLY the tests
 * the visit's own groups have gained, nothing else.
 */
export function SyncGroupTestsButton({
  visitId,
  drift,
}: {
  visitId: string;
  drift: { id: string; name: string; departmentName: string | null; missingFromGroup: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  // Group the drift under the group that gained them, for a readable summary.
  const byGroup = new Map<string, typeof drift>();
  for (const t of drift) {
    const k = t.missingFromGroup ?? "Other";
    byGroup.set(k, [...(byGroup.get(k) ?? []), t]);
  }

  function sync() {
    start(async () => {
      const r = await addTestsToVisit({ visitId, testIds: drift.map((t) => t.id) });
      if (r.ok) { toast.success(r.message ?? "Synced"); setOpen(false); router.refresh(); }
      else toast.error(r.error);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <RefreshCw className="size-4" /> Sync tests ({drift.length})
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Sync tests with groups"
        description="These tests were added to this visit's groups after it was created, so the visit never received them."
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={sync} loading={pending}>
              Sync {drift.length} test{drift.length === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {[...byGroup.entries()].map(([group, items]) => (
            <div key={group} className="rounded-lg border border-border p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">{group}</p>
              <div className="flex flex-wrap gap-1">
                {items.map((t) => (
                  <span key={t.id} className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              The <span className="font-semibold">bill will not change</span> — these are part of a group that was
              already paid for. The visit reopens so the new results can be entered and approved, and the existing
              approved results are left untouched.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
