"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, RotateCcw, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { collectSample, rejectSample, resetSample } from "@/lib/actions/sample-actions";

export function SampleRowActions({ sampleId, status }: { sampleId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [recollect, setRecollect] = useState(false);

  function doCollect() {
    start(async () => {
      const res = await collectSample(sampleId);
      res.ok ? toast.success(res.message ?? "Collected") : toast.error(res.error);
      if (res.ok) router.refresh();
    });
  }
  function doReset() {
    start(async () => {
      const res = await resetSample(sampleId);
      res.ok ? toast.success(res.message ?? "Reset") : toast.error(res.error);
      if (res.ok) router.refresh();
    });
  }
  function doReject() {
    if (reason.trim().length < 3) return toast.error("Please provide a reason");
    start(async () => {
      const res = await rejectSample(sampleId, reason, recollect);
      if (res.ok) {
        toast.success(res.message ?? "Done");
        setRejectOpen(false);
        setReason("");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <a href={`/print/label/${sampleId}`} target="_blank" rel="noreferrer" className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Print label">
        <Printer className="size-4" />
      </a>
      {status === "waiting" && (
        <>
          <Button size="sm" onClick={doCollect} loading={pending}><CheckCircle2 className="size-4" /> Collect</Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRejectOpen(true)}><XCircle className="size-4" /></Button>
        </>
      )}
      {(status === "rejected" || status === "recollection") && (
        <Button size="sm" variant="outline" onClick={doReset} loading={pending}><RotateCcw className="size-4" /> Re-draw</Button>
      )}

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject sample"
        description="Record why this sample cannot be processed."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={pending}>Cancel</Button>
            <Button variant="danger" onClick={doReject} loading={pending}>Confirm</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Reason" required>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Hemolysed / insufficient quantity" autoFocus />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={recollect} onChange={(e) => setRecollect(e.target.checked)} className="size-4 rounded border-border accent-[#075323]" />
            Mark for recollection (patient needs to give sample again)
          </label>
        </div>
      </Modal>
    </div>
  );
}
