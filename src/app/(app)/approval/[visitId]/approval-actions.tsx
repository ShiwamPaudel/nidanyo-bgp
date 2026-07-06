"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { approveVisit, sendBackResults } from "@/lib/actions/approval-actions";

export function ApprovalActions({
  visitId,
  hasSignature,
  dueRemaining,
}: {
  visitId: string;
  hasSignature: boolean;
  dueRemaining: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [approveOpen, setApproveOpen] = useState(false);
  const [backOpen, setBackOpen] = useState(false);
  const [interpretation, setInterpretation] = useState("");
  const [reason, setReason] = useState("");

  function doApprove() {
    start(async () => {
      const res = await approveVisit({ visitId, interpretation: interpretation || null });
      if (res.ok) {
        toast.success(res.message ?? "Approved");
        setApproveOpen(false);
        router.push("/approval");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function doSendBack() {
    if (reason.trim().length < 3) return toast.error("Please provide a reason");
    start(async () => {
      const res = await sendBackResults({ visitId, reason });
      if (res.ok) {
        toast.success(res.message ?? "Sent back");
        setBackOpen(false);
        router.push("/approval");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <>
      <Button variant="outline" className="text-destructive hover:bg-danger-50" onClick={() => setBackOpen(true)}>
        <Undo2 className="size-4" /> Send back
      </Button>
      <Button onClick={() => setApproveOpen(true)}>
        <CheckCircle2 className="size-4" /> Approve & sign
      </Button>

      <Modal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        title="Approve & sign results"
        description="Your signature will be applied to the final report."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setApproveOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={doApprove} loading={pending}>Approve</Button>
          </>
        }
      >
        <div className="space-y-3">
          {!hasSignature && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              No signature is assigned to your account yet. The report will show your name and designation. An administrator can upload your signature in Settings.
            </div>
          )}
          {dueRemaining > 0 && (
            <div className="rounded-lg border border-blue-200 bg-info-50 px-3 py-2 text-sm text-info">
              This bill still has an outstanding due. The report will be approved now but only released to the patient once payment is cleared.
            </div>
          )}
          <Field label="Interpretation / comments (optional)">
            <Textarea value={interpretation} onChange={(e) => setInterpretation(e.target.value)} placeholder="Clinical interpretation shown on the report" className="min-h-[80px]" />
          </Field>
        </div>
      </Modal>

      <Modal
        open={backOpen}
        onClose={() => setBackOpen(false)}
        title="Send back for correction"
        description="The technician will be asked to correct and resubmit."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setBackOpen(false)} disabled={pending}>Cancel</Button>
            <Button variant="danger" onClick={doSendBack} loading={pending}>Send back</Button>
          </>
        }
      >
        <Field label="Reason for correction" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Please re-check the WBC value" autoFocus />
        </Field>
      </Modal>
    </>
  );
}
