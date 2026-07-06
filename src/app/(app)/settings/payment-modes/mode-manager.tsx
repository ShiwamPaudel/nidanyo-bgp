"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { savePaymentMode, setPaymentModeActive } from "@/lib/actions/settings-actions";

export function NewModeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");

  function submit() {
    start(async () => {
      const res = await savePaymentMode({ name, category });
      if (res.ok) { toast.success(res.message ?? "Saved"); setOpen(false); setName(""); router.refresh(); }
      else toast.error(res.error);
    });
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add mode</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add payment mode" size="sm"
        footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button><Button onClick={submit} loading={pending}>Save</Button></>}>
        <div className="space-y-3">
          <Field label="Name" required><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. IME Pay" autoFocus /></Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="cash">Cash</option><option value="digital">Digital / Wallet / QR</option><option value="card">Card</option><option value="bank">Bank</option><option value="other">Other</option>
            </Select>
          </Field>
        </div>
      </Modal>
    </>
  );
}

export function ToggleModeButton({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={() => start(async () => { const r = await setPaymentModeActive(id, !active); r.ok ? toast.success(r.message ?? "") : toast.error(r.error); if (r.ok) router.refresh(); })}>
      {active ? "Disable" : "Enable"}
    </Button>
  );
}
