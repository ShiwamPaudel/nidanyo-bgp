"use client";

import { useMemo, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Plus, X, Trash2, Receipt, UserRound, UserPlus, Layers, FlaskConical, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Field } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, money, ageLabel } from "@/lib/utils";
import { searchPatientsSuggest } from "@/lib/actions/patient-actions";
import { createVisitWithBill } from "@/lib/actions/billing-actions";

type CatTest = { id: string; name: string; shortCode: string; price: number };
type CatGroup = { id: string; name: string; price: number; pricingMode: string; testIds: string[] };
type Mode = { id: string; name: string };
type Doctor = { id: string; name: string };
type SelPatient = { id: string; code: string; fullName: string; phone: string | null; gender: string; ageValue: number | null; ageUnit: string | null };
type NewPatient = { fullName: string; gender: "male" | "female" | "other"; ageValue: number | null; ageUnit: "years" | "months" | "days"; phone: string; email: string; address: string };

type Selected = { key: string; kind: "test" | "group"; refId: string; label: string; price: number };

const emptyNewPatient = (): NewPatient => ({ fullName: "", gender: "male", ageValue: null, ageUnit: "years", phone: "", email: "", address: "" });

export function VisitBillingForm({
  catalog,
  modes,
  doctors,
  currency,
  taxPercent,
  preselectedPatient,
}: {
  catalog: { tests: CatTest[]; groups: CatGroup[] };
  modes: Mode[];
  doctors: Doctor[];
  currency: string;
  taxPercent: number;
  preselectedPatient?: SelPatient | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Patient: either an existing selection, or inline new-patient details.
  const [patient, setPatient] = useState<SelPatient | null>(preselectedPatient ?? null);
  const [newPatient, setNewPatient] = useState<NewPatient | null>(null);

  const [selected, setSelected] = useState<Selected[]>([]);
  const [search, setSearch] = useState("");
  const [referredBy, setReferredBy] = useState("Self / Walk-in");
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [payAmount, setPayAmount] = useState(0);
  const [payModeId, setPayModeId] = useState(modes[0]?.id ?? "");
  const [payRef, setPayRef] = useState("");
  const [remarks, setRemarks] = useState("");

  const testById = useMemo(() => new Map(catalog.tests.map((t) => [t.id, t])), [catalog.tests]);
  const groupPrice = (g: CatGroup) => (g.pricingMode === "sum" ? g.testIds.reduce((s, id) => s + (testById.get(id)?.price ?? 0), 0) : g.price);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return {
      groups: catalog.groups.filter((g) => !q || g.name.toLowerCase().includes(q)),
      tests: catalog.tests.filter((t) => !q || t.name.toLowerCase().includes(q) || t.shortCode.toLowerCase().includes(q)),
    };
  }, [search, catalog]);

  const selectedKeys = new Set(selected.map((s) => s.key));
  function addItem(kind: "test" | "group", refId: string, label: string, price: number) {
    const key = `${kind}:${refId}`;
    if (selectedKeys.has(key)) return;
    setSelected((s) => [...s, { key, kind, refId, label, price }]);
  }
  function removeItem(key: string) { setSelected((s) => s.filter((x) => x.key !== key)); }
  // Per-bill rate edit for an individual test. Affects only this bill's line —
  // the test's catalog price is never changed.
  function setItemPrice(key: string, price: number) {
    setSelected((s) => s.map((x) => (x.key === key ? { ...x, price: Math.max(0, price || 0) } : x)));
  }

  const subtotal = selected.reduce((s, x) => s + x.price, 0);
  const disc = Math.min(discountType === "percent" ? (subtotal * (discountValue || 0)) / 100 : discountValue || 0, subtotal);
  const taxable = subtotal - disc;
  const tax = (taxable * taxPercent) / 100;
  const grand = taxable + tax;
  const due = Math.max(0, grand - (payAmount || 0));

  const hasPatient = !!patient || (!!newPatient && newPatient.fullName.trim().length >= 2);

  function submit() {
    if (!hasPatient) return toast.error("Select an existing patient or enter new patient details");
    if (selected.length === 0) return toast.error("Add at least one test or profile");
    startTransition(async () => {
      const res = await createVisitWithBill({
        patientId: patient?.id ?? null,
        newPatient: !patient && newPatient ? { ...newPatient, email: newPatient.email || null, phone: newPatient.phone || null, address: newPatient.address || null } : null,
        referredBy: referredBy || null,
        items: selected.map((s) => ({ kind: s.kind, refId: s.refId, priceOverride: s.price })),
        discountAmount: Math.round(disc * 100) / 100,
        discountReason: discountReason || null,
        paymentAmount: payAmount || 0,
        paymentModeId: payAmount > 0 ? payModeId : null,
        paymentReference: payRef || null,
        remarks: remarks || null,
      });
      if (res.ok) {
        toast.success(res.message ?? "Saved");
        router.push(`/visits/${res.data.visitId}`);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <PatientSection
          patient={patient}
          newPatient={newPatient}
          onSelectExisting={(p) => { setPatient(p); setNewPatient(null); }}
          onStartNew={() => { setPatient(null); setNewPatient(emptyNewPatient()); }}
          onChangeNew={setNewPatient}
          onClear={() => { setPatient(null); setNewPatient(null); }}
        />

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Select tests & profiles</CardTitle>
            <Badge tone="neutral">{selected.length} selected</Badge>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search tests or profiles…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="scroll-thin max-h-[340px] space-y-4 overflow-y-auto pr-1">
              {filtered.groups.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Layers className="size-3.5" /> Profiles</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filtered.groups.map((g) => {
                      const key = `group:${g.id}`;
                      const active = selectedKeys.has(key);
                      return <CatalogItem key={g.id} active={active} name={g.name} sub={`${g.testIds.length} tests`} price={groupPrice(g)} onClick={() => (active ? removeItem(key) : addItem("group", g.id, g.name, groupPrice(g)))} />;
                    })}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><FlaskConical className="size-3.5" /> Individual tests</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {filtered.tests.map((t) => {
                    const key = `test:${t.id}`;
                    const active = selectedKeys.has(key);
                    return <CatalogItem key={t.id} active={active} name={t.name} sub={t.shortCode} price={t.price} onClick={() => (active ? removeItem(key) : addItem("test", t.id, t.name, t.price))} />;
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bill summary */}
      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-20">
          <CardHeader className="flex-row items-center gap-2"><Receipt className="size-4 text-brand-700" /><CardTitle>Bill summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Referred by">
              {doctors.length > 0 ? (
                <Select value={referredBy} onChange={(e) => setReferredBy(e.target.value)}>
                  <option value="Self / Walk-in">Self / Walk-in</option>
                  {doctors.map((doc) => <option key={doc.id} value={doc.name}>{doc.name}</option>)}
                  <option value="">— None —</option>
                </Select>
              ) : (
                <Input value={referredBy} onChange={(e) => setReferredBy(e.target.value)} placeholder="Doctor / clinic name" />
              )}
            </Field>

            {selected.length === 0 ? (
              <p className="rounded-lg bg-surface p-3 text-sm text-muted-foreground">No items added yet. Select tests or profiles to build the bill.</p>
            ) : (
              <ul className="scroll-thin max-h-40 space-y-1.5 overflow-y-auto">
                {selected.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-1.5 truncate">{s.kind === "group" && <Layers className="size-3 shrink-0 text-info" />}<span className="truncate">{s.label}</span></span>
                    <span className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={0}
                        value={s.price || ""}
                        onChange={(e) => setItemPrice(s.key, Number(e.target.value))}
                        className="h-7 w-24 text-right tabular"
                        aria-label={`Rate for ${s.label}`}
                        title="Edit this item's rate for this bill only"
                      />
                      <button onClick={() => removeItem(s.key)} className="text-muted-foreground hover:text-destructive" aria-label="Remove"><X className="size-3.5" /></button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 border-t border-border pt-3 text-sm">
              <Row label="Subtotal" value={money(subtotal)} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Discount</span>
                <div className="flex items-center gap-1">
                  <Input type="number" min={0} value={discountValue || ""} onChange={(e) => setDiscountValue(Number(e.target.value))} className="h-8 w-20 text-right" placeholder="0" />
                  <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as "amount" | "percent")} className="h-8 w-16 px-2">
                    <option value="amount">{currency}</option>
                    <option value="percent">%</option>
                  </Select>
                </div>
              </div>
              {disc > 0 && (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Discount applied</span><span className="tabular">- {money(disc)}</span></div>
                  <Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Discount reason" className="h-8 text-xs" />
                </>
              )}
              {taxPercent > 0 && <Row label={`Tax (${taxPercent}%)`} value={money(tax)} />}
              <div className="flex items-center justify-between border-t border-border pt-2 text-base font-semibold"><span>Grand total</span><span className="tabular">{money(grand)}</span></div>
            </div>

            <div className="space-y-2 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Paying now"><Input type="number" min={0} value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value))} placeholder="0" /></Field>
                <Field label="Mode"><Select value={payModeId} onChange={(e) => setPayModeId(e.target.value)} disabled={!payAmount}>{modes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
              </div>
              {payAmount > 0 && <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Payment reference (optional)" className="h-9 text-sm" />}
              <div className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm"><span className="text-muted-foreground">Due after payment</span><span className={cn("font-semibold tabular", due > 0 ? "text-destructive" : "text-brand-700")}>{money(due)}</span></div>
              <button onClick={() => setPayAmount(grand)} className="text-xs font-medium text-info hover:underline" type="button">Mark full payment ({currency} {money(grand)})</button>
            </div>

            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks (optional)" className="min-h-[56px] text-sm" />
            <Button className="w-full" size="lg" onClick={submit} loading={pending} disabled={!hasPatient || selected.length === 0}><Plus className="size-4" /> Create visit & bill</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CatalogItem({ active, name, sub, price, onClick }: { active: boolean; name: string; sub: string; price: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex items-center justify-between gap-2 rounded-lg border p-2.5 text-left transition-colors", active ? "border-brand-600 bg-brand-50" : "border-border hover:border-brand-600 hover:bg-surface")}>
      <span className="min-w-0"><span className="block truncate text-sm font-medium">{name}</span><span className="block truncate text-xs text-muted-foreground">{sub}</span></span>
      <span className="flex flex-col items-end"><span className="text-sm font-semibold tabular">{money(price)}</span><span className={cn("text-[10px] font-medium", active ? "text-brand-700" : "text-info")}>{active ? "Added" : "Add +"}</span></span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between"><span className="text-muted-foreground">{label}</span><span className="tabular">{value}</span></div>;
}

/** Patient section: search existing, or register a new patient inline. */
function PatientSection({
  patient, newPatient, onSelectExisting, onStartNew, onChangeNew, onClear,
}: {
  patient: SelPatient | null;
  newPatient: NewPatient | null;
  onSelectExisting: (p: SelPatient) => void;
  onStartNew: () => void;
  onChangeNew: (p: NewPatient) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SelPatient[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (patient || newPatient) return;
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await searchPatientsSuggest(q);
      if (res.ok) { setResults(res.data as SelPatient[]); setOpen(true); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, patient, newPatient]);

  // Selected existing patient
  if (patient) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 pt-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-brand-700 text-white"><UserRound className="size-5" /></span>
            <div>
              <p className="font-semibold">{patient.fullName}</p>
              <p className="text-sm capitalize text-muted-foreground">{patient.code} · {patient.gender} · {ageLabel(patient.ageValue, patient.ageUnit)} · {patient.phone ?? "no phone"}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClear}><Trash2 className="size-4" /> Change</Button>
        </CardContent>
      </Card>
    );
  }

  // Inline new patient form
  if (newPatient) {
    const set = (k: keyof NewPatient, v: string | number | null) => onChangeNew({ ...newPatient, [k]: v });
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><UserPlus className="size-4 text-brand-700" /> New patient details</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClear}><ArrowLeft className="size-4" /> Search instead</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Full name" required><Input value={newPatient.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Ram Bahadur Thapa" autoFocus /></Field>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Gender" required><Select value={newPatient.gender} onChange={(e) => set("gender", e.target.value as NewPatient["gender"])}><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></Select></Field>
            <Field label="Age"><Input type="number" min={0} value={newPatient.ageValue ?? ""} onChange={(e) => set("ageValue", e.target.value === "" ? null : Number(e.target.value))} /></Field>
            <Field label="Unit"><Select value={newPatient.ageUnit} onChange={(e) => set("ageUnit", e.target.value as NewPatient["ageUnit"])}><option value="years">Years</option><option value="months">Months</option><option value="days">Days</option></Select></Field>
            <Field label="Phone"><Input value={newPatient.phone} onChange={(e) => set("phone", e.target.value)} placeholder="98XXXXXXXX" /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email (optional)"><Input type="email" value={newPatient.email} onChange={(e) => set("email", e.target.value)} placeholder="patient@email.com" /></Field>
            <Field label="Address"><Input value={newPatient.address} onChange={(e) => set("address", e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Search / choose
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between"><CardTitle>Patient</CardTitle><Button variant="subtle" size="sm" onClick={onStartNew}><UserPlus className="size-4" /> New patient</Button></CardHeader>
      <CardContent>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search existing patient by name or phone…" value={query} onChange={(e) => setQuery(e.target.value)} />
          {open && results.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lift">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => { onSelectExisting(r); setOpen(false); setQuery(""); }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-brand-50">
                    <span><span className="font-medium">{r.fullName}</span><span className="ml-2 text-xs capitalize text-muted-foreground">{r.gender} · {ageLabel(r.ageValue, r.ageUnit)} · {r.phone ?? "—"}</span></span>
                    <Badge tone="neutral">{r.code}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Existing patient? Search above. New patient? Click <span className="font-medium text-brand-700">New patient</span> to register and bill in one step.</p>
      </CardContent>
    </Card>
  );
}
