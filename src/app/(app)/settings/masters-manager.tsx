"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { TableWrap, Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/feedback";
import {
  saveDepartment, setDepartmentActive,
  saveSampleType, setSampleTypeActive,
  saveDoctor, setDoctorActive,
} from "@/lib/actions/masters-actions";

export type MasterKind = "department" | "sampleType" | "doctor";

export interface MasterItem {
  id: string;
  name: string;
  isActive: boolean;
  billingOnly?: boolean;
  colorHex?: string | null;
  qualification?: string | null;
  clinic?: string | null;
  phone?: string | null;
  commissionPercent?: number | null;
}

const CONFIG: Record<MasterKind, { singular: string; save: typeof saveDepartment; toggle: typeof setDepartmentActive }> = {
  department: { singular: "department", save: saveDepartment, toggle: setDepartmentActive },
  sampleType: { singular: "sample type", save: saveSampleType, toggle: setSampleTypeActive },
  doctor: { singular: "referring doctor", save: saveDoctor as never, toggle: setDoctorActive },
};

export function MastersManager({ kind, items, hint }: { kind: MasterKind; items: MasterItem[]; hint?: string }) {
  const cfg = CONFIG[kind];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MasterItem | null>(null);

  function openNew() { setEditing(null); setOpen(true); }
  function openEdit(it: MasterItem) { setEditing(it); setOpen(true); }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{hint}</p>
        <Button onClick={openNew}><Plus className="size-4" /> Add {cfg.singular}</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title={`No ${cfg.singular}s yet`} description={`Add your first ${cfg.singular}.`} />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                {kind === "doctor" && <><TH>Qualification</TH><TH>Clinic</TH><TH>Phone</TH></>}
                {kind === "sampleType" && <TH>Color</TH>}
                {kind === "department" && <TH>Type</TH>}
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {items.map((it) => (
                <TR key={it.id}>
                  <TD className="font-medium">{it.name}</TD>
                  {kind === "doctor" && <><TD className="text-muted-foreground">{it.qualification ?? "—"}</TD><TD className="text-muted-foreground">{it.clinic ?? "—"}</TD><TD className="text-muted-foreground tabular">{it.phone ?? "—"}</TD></>}
                  {kind === "sampleType" && <TD>{it.colorHex ? <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ background: it.colorHex }} />{it.colorHex}</span> : "—"}</TD>}
                  {kind === "department" && <TD>{it.billingOnly ? <Badge tone="neutral">Billing only</Badge> : <Badge tone="brand">Reportable</Badge>}</TD>}
                  <TD>{it.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <ToggleBtn kind={kind} id={it.id} active={it.isActive} />
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(it)} aria-label="Edit"><Pencil className="size-4" /></Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}

      {open && <MasterForm kind={kind} initial={editing} onClose={() => setOpen(false)} />}
    </>
  );
}

function ToggleBtn({ kind, id, active }: { kind: MasterKind; id: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={() => start(async () => {
      const r = await CONFIG[kind].toggle(id, !active);
      r.ok ? toast.success(r.message ?? "") : toast.error(r.error);
      if (r.ok) router.refresh();
    })}>{active ? "Disable" : "Enable"}</Button>
  );
}

function MasterForm({ kind, initial, onClose }: { kind: MasterKind; initial: MasterItem | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const cfg = CONFIG[kind];
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    billingOnly: initial?.billingOnly ?? false,
    colorHex: initial?.colorHex ?? "#075323",
    qualification: initial?.qualification ?? "",
    clinic: initial?.clinic ?? "",
    phone: initial?.phone ?? "",
    commissionPercent: initial?.commissionPercent ?? 0,
  });
  const set = (k: keyof typeof form, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    start(async () => {
      let res;
      if (kind === "department") res = await saveDepartment({ id: initial?.id, name: form.name, billingOnly: form.billingOnly });
      else if (kind === "sampleType") res = await saveSampleType({ id: initial?.id, name: form.name, colorHex: form.colorHex });
      else res = await saveDoctor({ id: initial?.id, name: form.name, qualification: form.qualification, clinic: form.clinic, phone: form.phone, commissionPercent: Number(form.commissionPercent) });
      if (res.ok) { toast.success(res.message ?? "Saved"); onClose(); router.refresh(); }
      else toast.error(res.error);
    });
  }

  return (
    <Modal open onClose={onClose} title={`${initial ? "Edit" : "Add"} ${cfg.singular}`} size="sm"
      footer={<><Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button><Button onClick={submit} loading={pending}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="Name" required><Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
        {kind === "department" && (
          <Field label="Billing only" hint="Charged on the bill but produces no lab report — no result entry, and no report QR on a bill made up only of these. Use for Dental, Radiology, Consultation, Physiotherapy…">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.billingOnly}
                onChange={(e) => set("billingOnly", e.target.checked)}
                className="size-4 rounded border-border accent-brand-700"
              />
              This department is for billing only
            </label>
          </Field>
        )}
        {kind === "sampleType" && (
          <Field label="Label color">
            <div className="flex items-center gap-2">
              <input type="color" value={form.colorHex} onChange={(e) => set("colorHex", e.target.value)} className="h-9 w-12 rounded border border-border" />
              <Input value={form.colorHex} onChange={(e) => set("colorHex", e.target.value)} className="flex-1" />
            </div>
          </Field>
        )}
        {kind === "doctor" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Qualification"><Input value={form.qualification} onChange={(e) => set("qualification", e.target.value)} placeholder="MBBS, MD" /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            </div>
            <Field label="Clinic / Hospital"><Input value={form.clinic} onChange={(e) => set("clinic", e.target.value)} /></Field>
            <Field label="Commission %" hint="Optional — for referral commission reports"><Input type="number" min={0} max={100} value={form.commissionPercent} onChange={(e) => set("commissionPercent", Number(e.target.value))} /></Field>
          </>
        )}
      </div>
    </Modal>
  );
}
