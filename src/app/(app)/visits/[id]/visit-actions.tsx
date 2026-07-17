"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, XCircle, RefreshCw, AlertTriangle, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { money } from "@/lib/utils";
import { receivePayment, cancelVisit, addTestsToVisit } from "@/lib/actions/billing-actions";
import { previewReferenceRangeSync, syncReferenceRanges, type RangeSyncPreviewItem } from "@/lib/actions/result-actions";

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
 * Add-on tests for an existing visit.
 *
 * A visit records what was ordered at the time, so editing a test group later
 * never reaches back into it — this is the supported way to pull those tests in.
 * Tests belonging to a group the visit already ordered are surfaced at the top,
 * since "the group gained members after the visit was created" is the common case.
 */
export function AddTestsButton({
  visitId,
  tests,
}: {
  visitId: string;
  tests: { id: string; name: string; departmentName: string | null; missingFromGroup: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const missing = tests.filter((t) => t.missingFromGroup);
  const term = q.trim().toLowerCase();
  const searchable = term
    ? tests.filter((t) => t.name.toLowerCase().includes(term) || (t.departmentName ?? "").toLowerCase().includes(term))
    : [];

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  function submit() {
    if (picked.size === 0) return toast.error("Select at least one test");
    start(async () => {
      const r = await addTestsToVisit({ visitId, testIds: [...picked] });
      if (r.ok) { toast.success(r.message ?? "Tests added"); setOpen(false); setPicked(new Set()); router.refresh(); }
      else toast.error(r.error);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FlaskConical className="size-4" /> Add tests
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add tests to this visit"
        description="The bill is not changed. The visit reopens so the new results can be entered and approved."
        size="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={submit} loading={pending} disabled={picked.size === 0}>
              Add {picked.size > 0 ? `${picked.size} test${picked.size === 1 ? "" : "s"}` : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {missing.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mb-2 flex items-start gap-2 text-[13px] text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <p>
                  <span className="font-semibold">Missing from a group this visit ordered.</span>{" "}
                  These were added to the group after the visit was created, so it never got them.
                </p>
              </div>
              <div className="space-y-1">
                {missing.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} className="size-4 rounded border-border accent-brand-700" />
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.missingFromGroup}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 text-xs font-medium text-info hover:underline"
                onClick={() => setPicked((p) => new Set([...p, ...missing.map((m) => m.id)]))}
              >
                Select all {missing.length}
              </button>
            </div>
          )}

          <Field label="Or search for any other test">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search test or department…" />
          </Field>

          {term && (
            <div className="max-h-[34vh] overflow-y-auto rounded-lg border border-border">
              {searchable.length === 0 ? (
                <p className="p-3 text-center text-sm text-muted-foreground">No matching test.</p>
              ) : (
                searchable.slice(0, 60).map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 border-b border-border/60 px-3 py-1.5 text-sm last:border-0 hover:bg-muted">
                    <input type="checkbox" checked={picked.has(t.id)} onChange={() => toggle(t.id)} className="size-4 rounded border-border accent-brand-700" />
                    <span>{t.name}</span>
                    {t.departmentName && <span className="ml-auto text-xs text-muted-foreground">{t.departmentName}</span>}
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
