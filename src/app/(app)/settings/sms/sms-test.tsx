"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { sendTestSms } from "@/lib/actions/settings-actions";

export function SmsTest() {
  const [pending, start] = useTransition();
  const [phone, setPhone] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Send a test message to" className="w-full max-w-xs">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98XXXXXXXX" />
      </Field>
      <Button
        onClick={() => start(async () => { const r = await sendTestSms(phone); r.ok ? toast.success(r.message ?? "Sent") : toast.error(r.error); })}
        loading={pending}
      >
        <Send className="size-4" /> Send test
      </Button>
    </div>
  );
}
