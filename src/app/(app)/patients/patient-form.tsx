"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { UserCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Field } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createPatient, updatePatient, searchPatientsSuggest } from "@/lib/actions/patient-actions";
import type { PatientInput } from "@/lib/validators/patient";
import { ageLabel } from "@/lib/utils";

type Suggestion = {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  gender: string;
  ageValue: number | null;
  ageUnit: string | null;
  visits: number;
};

export function PatientForm({
  mode,
  patientId,
  initial,
}: {
  mode: "create" | "edit";
  patientId?: string;
  initial?: Partial<PatientInput>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<PatientInput>({
    fullName: initial?.fullName ?? "",
    gender: (initial?.gender as PatientInput["gender"]) ?? "male",
    ageValue: initial?.ageValue ?? null,
    ageUnit: (initial?.ageUnit as PatientInput["ageUnit"]) ?? "years",
    dob: initial?.dob ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    address: initial?.address ?? "",
    referredBy: initial?.referredBy ?? "",
    notes: initial?.notes ?? "",
  });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(true);

  // Live returning-patient lookup (only when creating).
  useEffect(() => {
    if (mode !== "create" || !showSuggest) return;
    const q = (form.phone || form.fullName || "").trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await searchPatientsSuggest(q);
      if (res.ok) setSuggestions(res.data);
    }, 300);
    return () => clearTimeout(t);
  }, [form.phone, form.fullName, mode, showSuggest]);

  function set<K extends keyof PatientInput>(key: K, value: PatientInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      if (mode === "create") {
        const res = await createPatient(form);
        if (res.ok) {
          toast.success(res.message ?? "Patient registered");
          router.push(`/patients/${res.data.id}`);
          router.refresh();
        } else {
          if (res.fieldErrors) setErrors(res.fieldErrors);
          toast.error(res.error);
        }
      } else {
        const res = await updatePatient(patientId!, form);
        if (res.ok) {
          toast.success(res.message ?? "Saved successfully");
          router.push(`/patients/${patientId}`);
          router.refresh();
        } else {
          if (res.fieldErrors) setErrors(res.fieldErrors);
          toast.error(res.error);
        }
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={submit} className="lg:col-span-2">
        <Card>
          <CardContent className="space-y-4 pt-5">
            <Field label="Full name" htmlFor="fullName" required error={errors.fullName}>
              <Input id="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Ram Bahadur Thapa" autoFocus />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Gender" htmlFor="gender" required error={errors.gender}>
                <Select id="gender" value={form.gender} onChange={(e) => set("gender", e.target.value as PatientInput["gender"])}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Age" htmlFor="ageValue" error={errors.ageValue}>
                <Input id="ageValue" type="number" min={0} value={form.ageValue ?? ""} onChange={(e) => set("ageValue", e.target.value === "" ? null : Number(e.target.value))} placeholder="e.g. 32" />
              </Field>
              <Field label="Age unit" htmlFor="ageUnit">
                <Select id="ageUnit" value={form.ageUnit} onChange={(e) => set("ageUnit", e.target.value as PatientInput["ageUnit"])}>
                  <option value="years">Years</option>
                  <option value="months">Months</option>
                  <option value="days">Days</option>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" htmlFor="phone" error={errors.phone} hint="Used for report SMS notifications">
                <Input id="phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="98XXXXXXXX" inputMode="tel" />
              </Field>
              <Field label="Date of birth" htmlFor="dob" hint="Optional — used if age not given">
                <Input id="dob" type="date" value={form.dob ?? ""} onChange={(e) => set("dob", e.target.value)} />
              </Field>
            </div>

            <Field label="Email (optional)" htmlFor="email" error={errors.email}>
              <Input id="email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="patient@email.com" />
            </Field>

            <Field label="Address" htmlFor="address">
              <Input id="address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Tole, Municipality, District" />
            </Field>

            <Field label="Notes (optional)" htmlFor="notes">
              <Textarea id="notes" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Any relevant notes" />
            </Field>
          </CardContent>
        </Card>

        <div className="mt-4 flex items-center gap-2">
          <Button type="submit" loading={pending}>
            <Save className="size-4" /> {mode === "create" ? "Register patient" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Returning patient suggestions */}
      {mode === "create" && (
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="pt-5">
              <div className="mb-3 flex items-center gap-2">
                <UserCheck className="size-4 text-brand-700" />
                <h3 className="text-sm font-semibold">Possible existing patients</h3>
              </div>
              {suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Start typing a name or phone number. If the patient has visited before, they&apos;ll appear here so you can reuse their record.
                </p>
              ) : (
                <ul className="space-y-2">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/patients/${s.id}`}
                        className="block rounded-lg border border-border p-3 transition-colors hover:border-brand-600 hover:bg-brand-50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{s.fullName}</p>
                          <Badge tone="neutral">{s.code}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {s.gender} · {ageLabel(s.ageValue, s.ageUnit)} · {s.phone ?? "no phone"} · {s.visits} visit{s.visits === 1 ? "" : "s"}
                        </p>
                      </Link>
                    </li>
                  ))}
                  <li className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowSuggest(false)}
                      className="text-xs font-medium text-info hover:underline"
                    >
                      None of these — continue as a new patient
                    </button>
                  </li>
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
