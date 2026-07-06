"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Printer, UserCheck, MessageSquare, Mail, Download, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { recordDispatch, resendSms } from "@/lib/actions/dispatch-actions";

type Channel = "printed" | "collected" | "sms" | "email" | "downloaded";

export function DispatchActions({
  visitId,
  token,
  hasEmail,
  hasPhone,
}: {
  visitId: string;
  token: string | null;
  hasEmail: boolean;
  hasPhone: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);

  function mark(channel: Channel) {
    start(async () => {
      const res = await recordDispatch({ visitId, channel });
      res.ok ? toast.success(res.message ?? "Recorded") : toast.error(res.error);
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    });
  }
  function sms() {
    start(async () => {
      const res = await resendSms({ visitId });
      res.ok ? toast.success(res.message ?? "SMS sent") : toast.error(res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      {token && (
        <a href={`/print/report/${visitId}`} target="_blank" rel="noreferrer" className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Print report">
          <Printer className="size-4" />
        </a>
      )}
      {hasPhone && (
        <Button size="sm" variant="outline" onClick={sms} loading={pending} title="Resend SMS">
          <MessageSquare className="size-4" />
        </Button>
      )}
      <Button size="sm" onClick={() => setOpen(true)}>
        <Send className="size-4" /> Dispatch
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Mark report as dispatched" description="Record how the report was delivered to the patient." size="sm">
        <div className="grid grid-cols-2 gap-2">
          <DispatchBtn icon={Printer} label="Printed" onClick={() => mark("printed")} disabled={pending} />
          <DispatchBtn icon={UserCheck} label="Collected" onClick={() => mark("collected")} disabled={pending} />
          <DispatchBtn icon={MessageSquare} label="Sent by SMS" onClick={() => mark("sms")} disabled={pending || !hasPhone} />
          <DispatchBtn icon={Mail} label="Sent by email" onClick={() => mark("email")} disabled={pending || !hasEmail} />
          <DispatchBtn icon={Download} label="Downloaded" onClick={() => mark("downloaded")} disabled={pending} />
        </div>
      </Modal>
    </div>
  );
}

function DispatchBtn({ icon: Icon, label, onClick, disabled }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1.5 rounded-lg border border-border p-3 text-sm transition-colors hover:border-brand-600 hover:bg-brand-50 disabled:opacity-40">
      <Icon className="size-5 text-brand-700" />
      {label}
    </button>
  );
}
