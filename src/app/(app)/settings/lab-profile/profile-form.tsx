"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateLabProfile } from "@/lib/actions/settings-actions";
import type { LabProfileInput } from "@/lib/validators/settings";

export function LabProfileForm({ initial }: { initial: LabProfileInput }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState<LabProfileInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof LabProfileInput>(k: K, v: LabProfileInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    start(async () => {
      const res = await updateLabProfile(form);
      if (res.ok) { toast.success(res.message ?? "Saved"); router.refresh(); }
      else { if (res.fieldErrors) setErrors(res.fieldErrors); toast.error(res.error); }
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Laboratory details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field label="Lab name" required error={errors.name}><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Address"><Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
            <Field label="Email" error={errors.email}><Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website"><Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value)} /></Field>
            <Field label="PAN / VAT"><Input value={form.panVat ?? ""} onChange={(e) => set("panVat", e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Display preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Calendar" hint="Applies system-wide, to every user — dates shown across the app, bills and reports">
              <Select value={form.calendarSystem} onChange={(e) => set("calendarSystem", e.target.value as "AD" | "BS")}>
                <option value="AD">English (AD / Gregorian)</option>
                <option value="BS">Nepali (BS / Bikram Sambat)</option>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Billing preferences</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Currency"><Input value={form.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
              <Field label="Tax / VAT">
                <Select value={form.taxEnabled ? "on" : "off"} onChange={(e) => set("taxEnabled", e.target.value === "on")}>
                  <option value="off">Disabled</option>
                  <option value="on">Enabled</option>
                </Select>
              </Field>
            </div>
            {form.taxEnabled && <Field label="Tax percent"><Input type="number" min={0} max={100} value={form.taxPercent} onChange={(e) => set("taxPercent", Number(e.target.value))} /></Field>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Report & link settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Public link base URL" hint="Used for QR codes & report links on bills">
              <Input value={form.shortLinkBaseUrl ?? ""} onChange={(e) => set("shortLinkBaseUrl", e.target.value)} placeholder="https://reports.yourlab.com" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Top margin (mm)"><Input type="number" value={form.reportMarginTopMm} onChange={(e) => set("reportMarginTopMm", Number(e.target.value))} /></Field>
              <Field label="Bottom (mm)"><Input type="number" value={form.reportMarginBottomMm} onChange={(e) => set("reportMarginBottomMm", Number(e.target.value))} /></Field>
              <Field label="Side (mm)"><Input type="number" value={form.reportMarginXMm} onChange={(e) => set("reportMarginXMm", Number(e.target.value))} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.requirePhoneVerification} onChange={(e) => set("requirePhoneVerification", e.target.checked)} className="size-4 rounded border-border accent-[#075323]" />
              Ask patients to verify their phone before viewing public reports
            </label>
          </CardContent>
        </Card>

        <Button type="submit" loading={pending}><Save className="size-4" /> Save changes</Button>
      </div>
    </form>
  );
}
