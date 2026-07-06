"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { sendTestEmail } from "@/lib/actions/settings-actions";

export function EmailTest() {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Send a test email to" className="w-full max-w-xs">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
      </Field>
      <Button onClick={() => start(async () => { const r = await sendTestEmail(email); r.ok ? toast.success(r.message ?? "Sent") : toast.error(r.error); })} loading={pending}>
        <Send className="size-4" /> Send test
      </Button>
    </div>
  );
}
