"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { money } from "@/lib/utils";
import { receivePayment, cancelVisit } from "@/lib/actions/billing-actions";

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
